# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_credit_helpers'

RSpec.describe 'POS Report Analytics Admin API', type: :request do
  include PosCreditHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:manager) do
    credit_staff(
      store,
      branch,
      PosCreditHelpers::MANAGER + [Spree::Pos::Capabilities::INVENTORY_MANAGE, Spree::Pos::Capabilities::REPORT_READ],
      extra_permissions: %w[write_pos_topology read_pos_orders]
    )
  end

  let(:product) { create(:product, store: store, name: 'Trà sữa trân châu') }
  let(:variant) do
    v = product.default_variant
    v.update!(sku: 'TS-01', cost_price: 15_000, track_inventory: true)
    v
  end

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  let(:headers) do
    post '/api/v3/admin/auth/login', params: { email: manager.email, password: 'secret123' }, as: :json
    token = response.parsed_body.fetch('token')
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'returns overview, profit, inventory, inventory_summary, and transaction analytics' do
    # Seed a completed import stock document and income/expense vouchers
    post '/api/v3/admin/pos/stock/documents',
         params: {
           branch_id: branch.prefixed_id,
           kind: 'import',
           lines: [{ variant_id: variant.prefixed_id, quantity: 20, unit_cost: '15000' }]
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)
    doc_id = response.parsed_body.dig('data', 'id')

    post "/api/v3/admin/pos/stock/documents/#{doc_id}/complete", headers: headers, as: :json
    expect(response).to have_http_status(:ok)

    accounts = Spree::Pos::FundAccount.ensure_default!(store: store, branch: branch, actor: manager)
    cash = accounts.first

    Spree::Pos::FundVoucher.create!(
      store: store, branch: branch, fund_account: cash, actor: manager,
      code: 'PT00001', kind: 'income', status: 'completed', amount: 500_000,
      currency: 'VND', category_code: 'sales_other', occurred_at: Time.current
    )
    Spree::Pos::FundVoucher.create!(
      store: store, branch: branch, fund_account: cash, actor: manager,
      code: 'PC00001', kind: 'expense', status: 'completed', amount: 120_000,
      currency: 'VND', category_code: 'electricity', occurred_at: Time.current
    )

    today = Date.current.iso8601
    base_params = { branch_id: branch.prefixed_id, from: today, to: today }

    # 1. Overview
    get '/api/v3/admin/pos/reports/overview', params: base_params, headers: headers
    expect(response).to have_http_status(:ok)
    overview = response.parsed_body.fetch('data')
    expect(overview.dig('kpis', 'gross_sales', 'value')).to eq('0.0')
    expect(overview['trend']).to be_an(Array)
    expect(overview['by_source']).to be_an(Array)

    # 2. Profit (P&L + all group_by tabs)
    %w[day order product customer staff].each do |group_by|
      get '/api/v3/admin/pos/reports/profit', params: base_params.merge(group_by: group_by), headers: headers
      expect(response).to have_http_status(:ok)
      pnl = response.parsed_body.dig('data', 'pnl')
      expect(BigDecimal(pnl['other_income'])).to eq(BigDecimal('500000'))
      expect(BigDecimal(pnl['other_expense'])).to eq(BigDecimal('120000'))
      expect(BigDecimal(pnl['other_profit'])).to eq(BigDecimal('380000'))
    end

    # 3. Inventory analytics
    get '/api/v3/admin/pos/reports/inventory', params: base_params, headers: headers
    expect(response).to have_http_status(:ok)
    inv = response.parsed_body.fetch('data')
    expect(inv.dig('stock', 'total_quantity')).to eq(20)
    expect(BigDecimal(inv.dig('stock', 'total_value'))).to eq(BigDecimal('300000'))
    expect(BigDecimal(inv.dig('flow', 'import_value', 'value'))).to eq(BigDecimal('300000'))
    expect(inv['top_products'].first['sku']).to eq('TS-01')

    # 4. Inventory XNT summary
    get '/api/v3/admin/pos/reports/inventory_summary', params: base_params, headers: headers
    expect(response).to have_http_status(:ok)
    xnt_rows = response.parsed_body.fetch('data')
    row = xnt_rows.find { |r| r['sku'] == 'TS-01' }
    expect(row['inflow_qty']).to eq(20)
    expect(row['closing_qty']).to eq(20)
    expect(BigDecimal(response.parsed_body.dig('meta', 'totals', 'closing_value'))).to eq(BigDecimal('300000'))

    # 5. Transaction analytics
    get '/api/v3/admin/pos/reports/transaction', params: base_params, headers: headers
    expect(response).to have_http_status(:ok)
    tx = response.parsed_body.fetch('data')
    expect(BigDecimal(tx.dig('summary', 'total_income', 'value'))).to eq(BigDecimal('500000'))
    expect(BigDecimal(tx.dig('summary', 'total_expense', 'value'))).to eq(BigDecimal('120000'))
    expect(BigDecimal(tx.dig('summary', 'net_diff', 'value'))).to eq(BigDecimal('380000'))
    expect(tx['by_account']).not_to be_empty
  end
end
