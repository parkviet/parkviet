# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_kitchen_helpers'

# Staff mark dishes urgent at the counter and on the board; the mark follows
# the line to the kitchen, a recall raises it, and only a dish still to make
# can change.
RSpec.describe Spree::Pos::Kitchen::Priority do
  include PosKitchenHelpers

  let(:store) { menu_store }
  let(:branch) { kitchen_branch(store, trigger: 'manual') }
  let(:soup) { prepared_product!(store, branch, name: 'Phở bò', price: 50_000) }
  let(:rice) { prepared_product!(store, branch, name: 'Cơm tấm', price: 45_000) }
  let(:screen) { kitchen_screen!(branch, Spree::Pos::Device.new_token) }
  let(:sale) { menu_sale(store, branch) }

  before { kitchen_station!(branch, name: 'Bếp', default: true) }

  def mark_line(line, flag, version: line.reload.row_version, key: SecureRandom.uuid)
    Spree::Pos::Workspaces::SetLinePriority.call(workspace: sale.workspace.reload, staff: sale.cashier, key: key,
                                                 sale_line_id: line.prefixed_id, row_version: version, priority: flag)
  end

  def sent_items
    kitchen_send(sale)
    tickets_of(sale).flat_map(&:items)
  end

  describe 'from the counter' do
    it 'marks a line, bumps its version, and copies the mark to the ticket when it is sent' do
      add_menu(sale, size(soup))
      add_menu(sale, size(rice))
      urgent, plain = menu_lines(sale)
      before_version = urgent.row_version

      result = mark_line(urgent, true)
      expect(urgent.reload).to be_priority
      expect(urgent.row_version).to eq(before_version + 1)
      expect(result['line_items'].find { |row| row['sale_line_id'] == urgent.prefixed_id }['priority']).to be(true)

      items = sent_items
      expect(items.find { |item| item.sale_line_id == urgent.id }).to have_attributes(priority: true, priority_by: sale.cashier)
      expect(items.find { |item| item.sale_line_id == urgent.id }.priority_at).to be_present
      expect(items.find { |item| item.sale_line_id == plain.id }).to have_attributes(priority: false, priority_at: nil, priority_by: nil)

      printed = Spree::Pos::Kitchen::TicketDocument.build(tickets_of(sale).sole.reload)['header']
      expect(printed.count { |block| block['lines'] == ['ƯU TIÊN'] }).to eq(1)
    end

    it 'passes the mark to the items the kitchen is still making, and leaves finished ones alone' do
      add_menu(sale, size(soup))
      line = menu_lines(sale).sole
      item = sent_items.sole
      mark_line(line, true)
      expect(item.reload).to be_priority

      mark_line(line, false)
      expect(item.reload).to have_attributes(priority: false, priority_at: nil)

      Spree::Pos::Kitchen::ChangeItemStatus.call(item: item, action: 'ready', actor: screen)
      mark_line(line, true)
      expect(item.reload).not_to be_priority
      expect(line.reload).to be_priority
    end

    it 'refuses a line changed since the screen read it, and repeats nothing on the same value' do
      add_menu(sale, size(soup))
      line = menu_lines(sale).sole
      version = line.row_version
      mark_line(line, true)
      expect { mark_line(line, false, version: version) }.to raise_error(Spree::Pos::Conflict) { |error|
        expect(error.reason).to eq('line_changed')
      }

      stamp = line.reload.row_version
      mark_line(line, true)
      expect(line.reload.row_version).to eq(stamp)
    end

    it 'refuses a value that is not a boolean' do
      add_menu(sale, size(soup))
      expect { mark_line(menu_lines(sale).sole, 'soon') }.to raise_error(Spree::Pos::Conflict) { |error|
        expect(error.reason).to eq('kitchen_priority_invalid')
      }
    end
  end

  describe 'on the board' do
    let(:ticket) do
      add_menu(sale, size(soup))
      add_menu(sale, size(rice))
      kitchen_send(sale)
      tickets_of(sale).sole
    end

    it 'marks one item and takes the mark off, naming who and when' do
      item = ticket.items.first
      described_class.set_item(item: item, priority: true, actor: screen)
      expect(item.reload).to have_attributes(priority: true, priority_by: screen)
      expect(item.priority_at).to be_present
      expect(ticket.reload.to_pos).to include(priority: true)
      expect(item.to_pos).to include(priority: true)

      described_class.set_item(item: item, priority: false, actor: screen)
      expect(item.reload).to have_attributes(priority: false, priority_at: nil, priority_by: nil)
      expect(ticket.reload.to_pos).to include(priority: false)
    end

    it 'refuses an item that is ready' do
      item = ticket.items.first
      Spree::Pos::Kitchen::ChangeItemStatus.call(item: item, action: 'ready', actor: screen)
      expect { described_class.set_item(item: item, priority: true, actor: screen) }.to raise_error(Spree::Pos::Conflict) { |error|
        expect(error.reason).to eq('kitchen_status_invalid')
      }
    end

    it 'marks every open item of a ticket and skips the finished ones' do
      done, open = ticket.items.to_a
      Spree::Pos::Kitchen::ChangeItemStatus.call(item: done, action: 'ready', actor: screen)
      described_class.set_ticket(ticket: ticket, priority: true, actor: screen)
      expect(done.reload).not_to be_priority
      expect(open.reload).to be_priority
      expect(ticket.reload.to_pos[:priority]).to be(true)
    end

    it 'raises a recalled item by itself' do
      item = ticket.items.first
      Spree::Pos::Kitchen::ChangeItemStatus.call(item: item, action: 'ready', actor: screen)
      expect(item.reload).not_to be_priority
      Spree::Pos::Kitchen::ChangeItemStatus.call(item: item, action: 'recall', actor: screen)
      expect(item.reload).to have_attributes(status: 'preparing', priority: true, priority_by: screen)
      expect(item.priority_at).to be_present
    end
  end
end
