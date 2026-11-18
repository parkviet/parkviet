# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_shift_helpers'

RSpec.describe Spree::Pos::PrintDocuments::OrderFacts do
  include PosShiftHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD + [Spree::Pos::Capabilities::PRICE_OVERRIDE]) }

  before do
    allow(Spree::Store).to receive(:default).and_return(store)
    Spree::Pos::UnitDefinition.ensure_defaults!(store)
  end

  it 'reads table and area when seated, and returns nil when counter-served' do
    product = stocked_product(store, branch, price: 30_000)
    sale = open_sale(store, branch, cashier: cashier, product: product)
    expect(described_class.table(sale.workspace)).to be_nil

    area = Spree::Pos::Area.create!(store: store, branch: branch, name: 'Sân vườn', position: 1, floor_width: 10, floor_height: 10)
    resource = Spree::Pos::Resource.create!(store: store, branch: branch, area: area, name: 'Bàn 08', kind: 'table', shape: 'rect',
                                            capacity: 4, x: 1, y: 1, w: 2, h: 2, rotation: 0, position: 1)
    sale.workspace.update_columns(service_mode: 'dine_in', resource_id: resource.id)
    expect(described_class.table(sale.workspace.reload)).to eq('name' => 'Bàn 08', 'area' => 'Sân vườn')
  end

  it 'emits original_price only when unit_price differs from the variant list price' do
    product = stocked_product(store, branch, price: 45_000)
    product.default_variant.update!(barcode: '8935049501234')
    plain = open_sale(store, branch, cashier: cashier, product: product)
    plain_line = plain.workspace.order.line_items.first
    plain_sale_line = Spree::Pos::SaleLine.find_by!(line_item_id: plain_line.id)

    expect(described_class.barcode(plain_line.variant)).to eq('8935049501234')
    expect(described_class.original_price(
      variant: plain_line.variant, sale_line: plain_sale_line, line_price: plain_line.price,
      store: store, order: plain.workspace.order
    )).to be_nil

    plain_sale_line.update_columns(unit_price: 39_000)
    expect(described_class.original_price(
      variant: plain_line.variant, sale_line: plain_sale_line, line_price: plain_line.price,
      store: store, order: plain.workspace.order
    )).to eq('45000.0')
  end

  it 'sums non-timed line quantities into item_count and groups order discounts into promotions' do
    product = stocked_product(store, branch, price: 50_000)
    sale = open_sale(store, branch, cashier: cashier, product: product, quantity: 3)
    line = sale.workspace.order.line_items.first
    sl = Spree::Pos::SaleLine.find_by!(line_item_id: line.id)
    timed_sl = instance_double(Spree::Pos::SaleLine, kind: Spree::Pos::Timed::Lines::KIND, sale_quantity: BigDecimal('1'))

    expect(described_class.item_count([[line, sl], [line, timed_sl]])).to eq('3')

    Spree::Discount.create!(order: sale.workspace.order, line_item: line, label: 'Giảm khai trương', amount: -15_000, kind: 'promotion')
    expect(described_class.promotions(sale.workspace.order.reload)).to eq([{ 'name' => 'Giảm khai trương', 'amount' => '15000.0' }])
  end

  it 'computes customer_debt without double-counting the current credit order' do
    manager = credit_staff(store, branch, PosCreditHelpers::MANAGER)
    product = stocked_product(store, branch, price: 100_000, stock: 20)
    customer = credit_customer(store, cashier, name: 'Anh Minh')
    configure_credit(store, manager, branch, customer, limit: 5_000_000, due_days: 30)

    first = credit_order(store, branch, manager, customer, price: 100_000, product: product)
    expect(described_class.customer_debt(first.workspace)).to eq('previous' => '0.0', 'total' => '100000.0')

    second = credit_order(store, branch, manager, customer, price: 200_000)
    expect(described_class.customer_debt(second.workspace)).to eq('previous' => '100000.0', 'total' => '300000.0')
  end

  it 'returns nil transfer_qr without a receiving account, and omits amount when paid in full' do
    product = stocked_product(store, branch, price: 80_000)
    sale = open_sale(store, branch, cashier: cashier, product: product)
    expect(described_class.transfer_qr(sale.workspace, remaining_amount: 80_000)).to be_nil

    fake_account = Struct.new(:bank_bin, :bank_name, :account_number, :account_name).
                   new('970436', 'VCB', '007100999', 'PARKVIET')
    allow(Spree::Pos::PayLater).to receive(:receiving_account).with(store, branch).and_return(fake_account)

    unpaid_qr = described_class.transfer_qr(sale.workspace, remaining_amount: 80_000)
    expect(unpaid_qr).to include('bank' => 'VCB', 'account_number' => '007100999', 'account_name' => 'PARKVIET', 'amount' => '80000.0')
    expect(unpaid_qr['value']).to start_with('000201010212')
    expect(unpaid_qr['value']).to include('540580000')

    paid_qr = described_class.transfer_qr(sale.workspace, remaining_amount: 0)
    expect(paid_qr).not_to have_key('amount')
    expect(paid_qr['value']).to start_with('000201010211')
    expect(paid_qr['value']).not_to include('54010')
  end
end
