# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_shift_helpers'

RSpec.describe Spree::Pos::Einvoices::ReceiptInfo do
  include PosShiftHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD) }

  before do
    allow(Spree::Store).to receive(:default).and_return(store)
    Spree::Pos::UnitDefinition.ensure_defaults!(store)
  end

  it 'returns seller_tax_code from EinvoiceSetting (falling back to StoreInfo) along with number, symbol, template_code and cqt_code' do
    sale = paid_sale(store, branch, cashier: cashier, price: 100_000)
    Spree::Pos::StoreInfo.create!(
      store: store, name: 'Quán', phone: '0900000000', business_day_cutoff: '04:00', tax_code: '0311111111'
    )
    einvoice = Spree::Pos::Einvoice.create!(
      store: store, branch: branch, order: sale.workspace.order, workspace: sale.workspace,
      created_by: cashier, status: 'issued', invoice_type: 'cash_register', relation: 'original',
      provider: 'viettel', currency: 'VND', template_code: '1', symbol: 'C26TAA',
      number: '00000999', cqt_code: 'M1-26-XYZ-999', lookup_code: 'LC999',
      lookup_url: 'https://tracuu.example.test/LC999',
      buyer: {}, seller: {}, lines_snapshot: [], totals_snapshot: { 'total' => '100000.0' },
      payment_method: 'cash', issued_at: Time.current
    )

    fallback_info = described_class.for_workspace(sale.workspace.id)
    expect(fallback_info).to include(
      status: 'issued', seller_tax_code: '0311111111', template_code: '1', symbol: 'C26TAA',
      number: '00000999', cqt_code: 'M1-26-XYZ-999', lookup_code: 'LC999',
      lookup_url: 'https://tracuu.example.test/LC999', buyer_url: nil
    )

    Spree::Pos::EinvoiceSetting.create!(
      store: store, branch: branch, provider: 'viettel', status: 'active',
      seller_tax_code: '0102222222', template_code: '1', symbol: 'C26TAA'
    )
    setting_info = described_class.for_workspace(einvoice.workspace_id)
    expect(setting_info[:seller_tax_code]).to eq('0102222222')
  end
end
