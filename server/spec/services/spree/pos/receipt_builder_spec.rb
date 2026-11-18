# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../support/pos_shift_helpers'

RSpec.describe Spree::Pos::ReceiptBuilder do
  include PosShiftHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD) }

  before do
    allow(Spree::Store).to receive(:default).and_return(store)
    Spree::Pos::UnitDefinition.ensure_defaults!(store)
  end

  it 'writes store tax_code, description, check_in_at, order_source, barcode, note, item_count and customer_debt into sale snapshots' do
    Spree::Pos::StoreInfo.create!(
      store: store, name: 'ParkViet Flagship', phone: '0909000111', business_day_cutoff: '04:00',
      tax_code: '0109876543', description: 'Đặc sản rang xay'
    )
    customer = Spree::Pos::CustomerProfile.create!(store: store, name: 'Chị Hoa', phone: '0912345678', created_by: cashier)
    area = Spree::Pos::Area.create!(store: store, branch: branch, name: 'Tầng 2', position: 1, floor_width: 8, floor_height: 8)
    resource = Spree::Pos::Resource.create!(store: store, branch: branch, area: area, name: 'VIP 2', kind: 'table', shape: 'rect',
                                            capacity: 6, x: 0, y: 0, w: 2, h: 2, rotation: 0, position: 1)

    product = stocked_product(store, branch, price: 60_000)
    product.default_variant.update!(barcode: '8936000001112')
    sale = open_sale(store, branch, cashier: cashier, product: product, quantity: 2)
    sale.workspace.update_columns(service_mode: 'dine_in', resource_id: resource.id, order_source: 'zalo')
    sale.workspace.update!(pos_customer: customer)
    Spree::Pos::SaleLine.where(workspace_id: sale.workspace.id).update_all(note: 'Không đường', unit_price: 55_000)
    complete_paid(sale)
    hand_over(sale)

    snapshot = Spree::Pos::ReceiptSnapshot.find_by!(source_type: 'sale', source_id: sale.workspace.id)
    payload = snapshot.payload
    expect(payload['store']).to include('name' => 'ParkViet Flagship', 'tax_code' => '0109876543', 'description' => 'Đặc sản rang xay')
    expect(payload['table']).to eq('name' => 'VIP 2', 'area' => 'Tầng 2')
    expect(payload['check_in_at']).to be_present
    expect(payload['order_source']).to eq('zalo')
    expect(payload['item_count']).to eq('2')
    expect(payload['customer_debt']).to eq('previous' => '0.0', 'total' => '0.0')
    expect(payload['lines'].first).to include('barcode' => '8936000001112', 'original_price' => '60000.0', 'note' => 'Không đường')
  end

  it 'keeps checkout snapshot creation intact when an optional OrderFacts lookup raises' do
    allow(Spree::Pos::PrintDocuments::OrderFacts).to receive(:customer_debt).and_raise(StandardError, 'boom')
    sale = paid_sale(store, branch, cashier: cashier, price: 25_000)

    snapshot = Spree::Pos::ReceiptSnapshot.find_by!(source_type: 'sale', source_id: sale.workspace.id)
    expect(snapshot.payload).not_to have_key('customer_debt')
    expect(snapshot.payload['item_count']).to eq('1')
  end
end
