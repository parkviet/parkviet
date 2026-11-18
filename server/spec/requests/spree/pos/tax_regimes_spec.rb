# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_schema_helpers'

# The tax regime API: topology writers read, save and preview it; any
# topology reader lists the tax options; every response matches
# pos-staff.yaml.
RSpec.describe 'POS tax regime API', type: :request do
  include PosSchemaHelpers

  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }
  let(:writer) { staff_with(%w[write_pos_topology]) }
  let(:reader) { staff_with(%w[read_pos_topology]) }

  before { Spree::Pos::TaxCategories.seed!(store) }

  def staff_with(permissions)
    user = create(:admin_user, :without_admin_role, password: password)
    create(:role_user, user: user, role: create(:role, resource: store, permissions: permissions))
    user
  end

  def headers(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: password }, as: :json
      response.parsed_body.fetch('token')
    end
    { 'Authorization' => "Bearer #{@tokens[user.id]}" }
  end

  it 'shows the regime in force with its history and options to topology writers only' do
    get '/api/v3/admin/pos/tax_regime', headers: headers(reader)
    expect(response).to have_http_status(:forbidden)

    get '/api/v3/admin/pos/tax_regime', headers: headers(writer)
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'TaxRegimeState')
    data = response.parsed_body['data']
    expect(data['regime']).to include('method' => 'deduction', 'revenue_group' => 'group_3', 'enabled' => true)
    expect(data['history'].size).to eq(1)
    expect(data['options'].pluck('option')).to eq(Spree::Pos::VnTaxCatalog.options('deduction').pluck(:code))
    expect(data['available_options']['direct'].size).to eq(Spree::Pos::VnTaxCatalog.options('direct').size)
    expect(data['revenue_year']).to include('threshold' => '1000000000.0', 'tax_due' => false)
    expect(data['readiness']).to include('total' => 9)
  end

  it 'saves a direct regime, lists its options for every picker and pages the history' do
    put '/api/v3/admin/pos/tax_regime', headers: headers(reader), params: { method: 'direct' }, as: :json
    expect(response).to have_http_status(:forbidden)

    body = { method: 'direct', revenue_group: 'group_2', pit_method: 'revenue', item_option: 'direct.service',
             shipping_option: 'direct.production_transport_food', apply_to_all_products: true }
    put '/api/v3/admin/pos/tax_regime', headers: headers(writer), params: body, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'TaxRegimeState')
    regime = response.parsed_body.dig('data', 'regime')
    expect(regime).to include('method' => 'direct', 'pit_method' => 'revenue')
    expect(regime.dig('default_item', 'option')).to eq('direct.service')

    get '/api/v3/admin/pos/tax_options', headers: headers(reader)
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'TaxOption')
    service = response.parsed_body['data'].find { |row| row['option'] == 'direct.service' }
    expect(service).to include('label' => 'GTGT 5% – TNCN 2%', 'defaults' => %w[item service_fee], 'vat_rate' => '0.05')
    expect(service['tax_category_id']).to eq(regime.dig('default_item', 'tax_category_id'))

    get '/api/v3/admin/pos/tax_regime', headers: headers(writer), params: { limit: 1, page: 2 }
    expect(response.parsed_body['data']['history'].sole).to include('method' => 'deduction')
    expect(response.parsed_body['meta']).to include('count' => 2, 'pages' => 2)
  end

  it 'returns field errors under the keys the form uses' do
    put '/api/v3/admin/pos/tax_regime', headers: headers(writer),
                                        params: { method: 'deduction', revenue_group: 'group_1', item_option: 'direct.goods' }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body.dig('error', 'details').keys).to include('method', 'item_option')
  end

  it 'previews an unsaved regime without saving it' do
    post '/api/v3/admin/pos/tax_regime/preview', headers: headers(writer),
                                                 params: { method: 'direct', revenue_group: 'group_1', item_option: 'direct.service' }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'TaxPreview')
    data = response.parsed_body['data']
    expect(data).to include('method' => 'direct', 'customer_total' => '120000.0', 'vat_total' => '5600.0', 'pit_total' => '2300.0')
    expect(data['lines'].map { |line| line.values_at('kind', 'customer_amount', 'printed') }).to eq(
      [['item', '100000.0', false], ['shipping', '20000.0', false]]
    )

    post '/api/v3/admin/pos/tax_regime/preview', headers: headers(writer),
                                                 params: { item_option: 'deduction.vat_10', shipping_option: 'deduction.vat_10',
                                                           prices_include_tax: false }, as: :json
    data = response.parsed_body['data']
    expect(data).to include('method' => 'deduction', 'customer_total' => '132000.0', 'vat_total' => '12000.0')
    expect(data['lines'].first).to include('vat_amount' => '10000.0', 'printed' => true)
    expect(Spree::Pos::TaxRegime.for_store(store).count).to eq(1)
  end
end
