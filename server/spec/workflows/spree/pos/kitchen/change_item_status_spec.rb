# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_kitchen_helpers'

# Kitchen items move forward one listed step at a time on the database
# clock; repeating a step is harmless, any other move is refused.
RSpec.describe Spree::Pos::Kitchen::ChangeItemStatus do
  include PosKitchenHelpers

  let(:store) { menu_store }
  let(:branch) { kitchen_branch(store, trigger: 'manual') }
  let(:item) { prepared_product!(store, branch, name: 'Phở bò', price: 50_000) }
  let(:screen) { kitchen_screen!(branch, Spree::Pos::Device.new_token) }
  let(:sale) { menu_sale(store, branch) }
  let(:ticket) do
    kitchen_station!(branch, name: 'Bếp', default: true)
    add_menu(sale, size(item))
    add_menu(sale, size(item), note: 'Không hành')
    kitchen_send(sale)
    tickets_of(sale).sole
  end
  let(:first) { ticket.items.first }

  def move(row, action)
    described_class.call(item: row, action: action, actor: screen)
    row.reload
  end

  it 'walks an item from new to served and stamps every step' do
    expect(move(first, 'start')).to have_attributes(status: 'preparing', changed_by: screen)
    expect(first.started_at).to be_present
    expect(move(first, 'ready')).to have_attributes(status: 'ready')
    expect(first.ready_at).to be >= first.started_at
    expect(move(first, 'serve')).to have_attributes(status: 'served')
    expect(first.served_at).to be_present
  end

  it 'repeats a step without changing anything and refuses moves that are not listed' do
    move(first, 'start')
    stamp = first.started_at
    expect(move(first, 'start').started_at).to eq(stamp)

    expect { move(first, 'serve') }.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_status_invalid') }
    expect { move(first, 'recall') }.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_status_invalid') }
    expect { move(first, 'cook') }.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_action_invalid') }
    move(first, 'ready')
    move(first, 'serve')
    expect { move(first, 'ready') }.to raise_error(Spree::Pos::Conflict)
  end

  it 'recalls a ready item within 30 minutes only' do
    move(first, 'ready')
    expect(move(first, 'recall')).to have_attributes(status: 'preparing', ready_at: nil)

    move(first, 'ready')
    later = first.ready_at + 31.minutes
    allow(Spree::Pos::Workspace).to receive(:database_now).and_return(later)
    expect { move(first, 'recall') }.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_recall_expired') }
  end

  it 'calls a served item back, counts it and names a person in the audit log' do
    cook = credit_staff(store, branch, [Spree::Pos::Capabilities::OPERATE_KITCHEN])
    move(first, 'ready')
    move(first, 'serve')
    described_class.call(item: first, action: 'recall', actor: cook)
    expect(first.reload).to have_attributes(status: 'preparing', ready_at: nil, served_at: nil, recall_count: 1, changed_by: cook)
    expect(first.recalled_at).to be_present
    audit = Spree::Pos::AuditEntry.where(action: 'kitchen.recall').sole
    expect(audit).to have_attributes(actor: cook, subject_id: first.id)
    expect(audit.metadata).to include('recall_count' => 1)

    # A kitchen screen is not a person: the item keeps who moved it instead.
    move(first, 'ready')
    expect(move(first, 'recall')).to have_attributes(recall_count: 2, changed_by: screen)
    expect(Spree::Pos::AuditEntry.where(action: 'kitchen.recall').count).to eq(1)
  end

  it 'refuses to recall a served item more than 30 minutes after it went out' do
    move(first, 'ready')
    move(first, 'serve')
    allow(Spree::Pos::Workspace).to receive(:database_now).and_return(first.served_at + 31.minutes)
    expect { move(first, 'recall') }.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_recall_expired') }
  end

  it 'keeps how long an item took and whether it passed the red threshold' do
    sent = ticket.sent_at
    allow(Spree::Pos::Workspace).to receive(:database_now).and_return(sent + 5.minutes)
    expect(move(first, 'ready')).to have_attributes(prep_seconds: 300, late: false)

    allow(Spree::Pos::Workspace).to receive(:database_now).and_return(sent + 16.minutes)
    second = ticket.items.second
    expect(move(second, 'ready')).to have_attributes(prep_seconds: 960, late: true)

    move(second, 'recall')
    expect(second.reload).to have_attributes(prep_seconds: nil, late: false)
  end

  it 'bumps one dish on the all-day view oldest first, a whole item at a time' do
    soup = size(item)
    kitchen_station!(branch, name: 'Bếp', default: true)
    add_menu(sale, soup, quantity: 2)
    kitchen_send(sale)
    later = menu_sale(store, branch)
    add_menu(later, soup)
    kitchen_send(later)
    old_item = tickets_of(sale).sole.items.sole
    new_item = tickets_of(later).sole.items.sole
    key = Spree::Pos::Kitchen::Board.all_day_key(new_item)
    expect(Spree::Pos::Kitchen::Board.all_day_key(old_item)).to eq(key)
    stations = Spree::Pos::KitchenStation.where(branch_id: branch.id).to_a

    moved = described_class.bump_all_day(stations: stations, key: key, actor: screen)
    expect(moved.map(&:id)).to eq([old_item.kitchen_ticket_id])
    expect(old_item.reload.status).to eq('ready')
    expect(new_item.reload.status).to eq('new')

    described_class.bump_all_day(stations: stations, key: key, actor: screen)
    expect(new_item.reload.status).to eq('ready')
    expect { described_class.bump_all_day(stations: stations, key: key, actor: screen) }.
      to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_all_day_empty') }
    expect { described_class.bump_all_day(stations: stations, key: key, quantity: 0, actor: screen) }.
      to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('kitchen_all_day_invalid') }
  end

  it 'bumps every open item of the ticket to ready and announces the ticket' do
    move(first, 'start')
    expect do
      described_class.bump(ticket: ticket, actor: screen)
    end.to have_broadcasted_to(Spree::Pos::Realtime.stream_name(branch)).with(hash_including(event: 'kitchen_ticket.updated', id: ticket.prefixed_id))
    expect(ticket.items.reload.map(&:status)).to eq(%w[ready ready])
    expect(ticket.reload.done?).to be(true)

    expect do
      described_class.bump(ticket: ticket, actor: screen)
    end.not_to have_broadcasted_to(Spree::Pos::Realtime.stream_name(branch))
  end

  describe 'ready tickets' do
    def ready_printer(name:, roles: %w[ready_ticket])
      station_device = Spree::Pos::Device.find_by(branch: branch, mode: 'print_station') ||
                       kitchen_screen!(branch, Spree::Pos::Device.new_token, mode: 'print_station')
      Spree::Pos::Printer.create!(
        store: store, branch: branch, name: name, connection: 'escpos_lan', address: '192.168.1.99',
        print_station_device: station_device, paper: '80mm', command_language: 'escpos', roles: roles
      )
    end

    it 'stays silent when auto_print_ready_ticket is off or when no printer takes ready_ticket' do
      ready_printer(name: 'Ra món')
      described_class.bump(ticket: ticket, actor: screen)
      expect(Spree::Pos::PrintJob.where(kind: 'ready_ticket')).to be_empty

      branch.update!(sales_settings: { 'auto_print_ready_ticket' => true })
      Spree::Pos::Printer.where(branch: branch).delete_all
      sale2 = menu_sale(store, branch)
      add_menu(sale2, size(item))
      kitchen_send(sale2)
      expect { described_class.bump(ticket: tickets_of(sale2).sole, actor: screen) }.not_to raise_error
      expect(Spree::Pos::PrintJob.where(kind: 'ready_ticket')).to be_empty
    end

    it 'queues one ready ticket per bump, deduplicates retries, reprints after recall, and prefers the expo printer' do
      branch.update!(sales_settings: { 'auto_print_ready_ticket' => true })
      fallback = ready_printer(name: 'Quầy chung')
      expo_printer = ready_printer(name: 'Máy quầy expo')
      expo = kitchen_station!(branch, name: 'Ra món', kind: 'expo', position: 2)
      expo.update!(printer: expo_printer)
      prep = kitchen_station!(branch, name: 'Bếp nóng', default: true)
      prep.update!(expo_station: expo)

      sale.workspace.update!(guest_name: 'Anh Minh')
      add_menu(sale, size(item))
      add_menu(sale, size(item), note: 'Ít bánh')
      kitchen_send(sale)
      fired = tickets_of(sale).sole

      described_class.bump(ticket: fired, actor: screen)
      jobs = Spree::Pos::PrintJob.where(kind: 'ready_ticket').order(:id)
      expect(jobs.count).to eq(1)
      job = jobs.sole
      expect(job.printer_id).to eq(expo_printer.id)
      expect(job.printer_id).not_to eq(fallback.id)
      lines = job.document['header'].flat_map { |block| block['lines'] || [block['title']] }
      expect(lines).to include('PHIẾU TRẢ MÓN', '1 x Phở bò', 'Ghi chú: Ít bánh', 'Trạm: Bếp nóng')
      expect(job.to_pos[:label]).not_to eq('Bếp nóng')

      # Repeating the bump changes no status and queues no second job.
      described_class.bump(ticket: fired.reload, actor: screen)
      expect(Spree::Pos::PrintJob.where(kind: 'ready_ticket').count).to eq(1)

      # When the expo printer cannot accept queued jobs (e.g. browser printer), falls back to the live station printer.
      browser_expo = Spree::Pos::Printer.create!(
        store: store, branch: branch, name: 'Trình duyệt expo', connection: 'browser',
        paper: '80mm', command_language: 'escpos', roles: %w[ready_ticket]
      )
      expo.update!(printer: browser_expo)

      # Recalling an item and marking it ready again prints a new slip on the fallback station printer.
      recalled = fired.items.first
      allow(Spree::Pos::Workspace).to receive(:database_now).and_return(recalled.ready_at + 1.minute)
      move(recalled, 'recall')
      allow(Spree::Pos::Workspace).to receive(:database_now).and_return(Time.current + 2.minutes)
      move(recalled, 'ready')
      expect(Spree::Pos::PrintJob.where(kind: 'ready_ticket').count).to eq(2)
      expect(Spree::Pos::PrintJob.where(kind: 'ready_ticket').order(:id).last.printer_id).to eq(fallback.id)
    end
  end
end
