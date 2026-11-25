# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_credit_helpers'

RSpec.describe 'POS Stock Management and Partners Admin API', type: :request do
  include PosCreditHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:manager) do
    credit_staff(
      store,
      branch,
      PosCreditHelpers::MANAGER + [Spree::Pos::Capabilities::INVENTORY_MANAGE],
      extra_permissions: %w[write_pos_topology]
    )
  end

  let(:product) { create(:product, store: store, name: 'Cà phê hạt Arabica') }
  let(:variant) do
    v = product.default_variant
    v.update!(sku: 'CF-ARA-1KG', cost_price: 200_000, track_inventory: true)
    v
  end

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  let(:headers) do
    post '/api/v3/admin/auth/login', params: { email: manager.email, password: 'secret123' }, as: :json
    token = response.parsed_body.fetch('token')
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'creates partner groups, suppliers, and customers, then runs import, export, count, opening, and ledger' do
    # 1. Partner groups
    post '/api/v3/admin/pos/partner_groups',
         params: { kind: 'supplier', name: 'NCC Rang xay' }, headers: headers, as: :json
    expect(response).to have_http_status(:created)
    supp_group_id = response.parsed_body.dig('data', 'id')

    post '/api/v3/admin/pos/partner_groups',
         params: { kind: 'customer', name: 'Khách VIP' }, headers: headers, as: :json
    expect(response).to have_http_status(:created)
    cust_group_id = response.parsed_body.dig('data', 'id')

    # 2. Supplier
    post '/api/v3/admin/pos/suppliers',
         params: {
           name: 'Công ty Cà Phê Đà Lạt',
           phone: '0901234567',
           tax_code: '0101234567',
           partner_group_id: supp_group_id,
           opening_payable: '500000'
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)
    supplier_id = response.parsed_body.dig('data', 'id')
    expect(response.parsed_body.dig('data', 'code')).to start_with('NCC')

    # 3. Customer
    post '/api/v3/admin/pos/partner_customers',
         params: {
           name: 'Nguyễn Văn A',
           phone: '0987654321',
           partner_group_id: cust_group_id,
           tags: ['VIP']
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)
    customer_id = response.parsed_body.dig('data', 'id')
    expect(response.parsed_body.dig('data', 'code')).to start_with('KH')

    get '/api/v3/admin/pos/partner_customers', headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['data'].map { |r| r['id'] }).to include(customer_id)

    # 4. Opening balance (10 units @ 200,000)
    post '/api/v3/admin/pos/stock/documents',
         params: {
           branch_id: branch.prefixed_id,
           kind: 'opening',
           complete_now: true,
           lines: [{ variant_id: variant.prefixed_id, quantity: 10, unit_cost: '200000' }]
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig('data', 'status')).to eq('completed')

    # 5. Import (5 units @ 220,000, tax 10%, paid 500,000)
    post '/api/v3/admin/pos/stock/documents',
         params: {
           branch_id: branch.prefixed_id,
           kind: 'import',
           supplier_id: supplier_id,
           invoice_type: 'vat_invoice',
           tax_rate: '10',
           paid_amount: '500000',
           complete_now: true,
           lines: [{ variant_id: variant.prefixed_id, quantity: 5, unit_cost: '220000' }]
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)
    import_id = response.parsed_body.dig('data', 'id')
    expect(response.parsed_body.dig('data', 'total_amount').to_d).to eq(1_210_000)
    expect(response.parsed_body.dig('data', 'payment_status')).to eq('partial')

    # 6. Export (3 units)
    post '/api/v3/admin/pos/stock/documents',
         params: {
           branch_id: branch.prefixed_id,
           kind: 'export',
           export_reason: 'damage',
           complete_now: true,
           lines: [{ variant_id: variant.prefixed_id, quantity: 3, unit_cost: '220000' }]
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)

    # 7. Stock overview should show 10 + 5 - 3 = 12 on hand
    get '/api/v3/admin/pos/stock/overview', params: { branch_id: branch.prefixed_id }, headers: headers
    expect(response).to have_http_status(:ok)
    row = response.parsed_body['data'].find { |r| r['variant_id'] == variant.prefixed_id }
    expect(row['on_hand']).to eq(12)

    # 8. Stock-taking count: actual 15 (+3 variance)
    post '/api/v3/admin/pos/stock/documents',
         params: {
           branch_id: branch.prefixed_id,
           kind: 'count',
           complete_now: true,
           lines: [{ variant_id: variant.prefixed_id, actual_quantity: 15, unit_cost: '220000' }]
         },
         headers: headers, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig('data', 'variance_quantity')).to eq(3)

    # 9. Stock ledger shows all 4 movements
    get '/api/v3/admin/pos/stock/ledger', params: { branch_id: branch.prefixed_id }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['data'].size).to be >= 4

    # 10. Supplier payable = opening 500,000 + import 1,210,000 - paid 500,000 = 1,210,000
    get "/api/v3/admin/pos/suppliers/#{supplier_id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'payable_balance').to_d).to eq(1_210_000)

    # Pay remaining on import
    post "/api/v3/admin/pos/stock/documents/#{import_id}/pay",
         params: { amount: '710000', payment_method: 'bank' }, headers: headers, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'payment_status')).to eq('paid')
  end
end
