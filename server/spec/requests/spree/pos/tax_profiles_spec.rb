# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_schema_helpers'

# The tax declaration details: readers see them, topology writers change
# them, and every response matches pos-staff.yaml.
RSpec.describe 'POS tax profile API', type: :request do
  include PosSchemaHelpers

  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }
  let(:writer) { staff_with(%w[write_pos_topology]) }
  let(:reader) { staff_with(%w[read_pos_topology]) }
  let!(:branch) do
    location = create(:stock_location, store: store, backorderable_default: false)
    Spree::Pos::Branch.create!(store: store, stock_location: location, name: 'Quầy chính', code: "m#{SecureRandom.hex(3)}",
                               timezone: 'Asia/Ho_Chi_Minh', status: 'active')
  end

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

  it 'shows an empty profile with every field missing until the store information is saved' do
    get '/api/v3/admin/pos/tax_profile', headers: headers(reader)
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'TaxProfile')
    data = response.parsed_body['data']
    expect(data).to include('id' => nil, 'store_info_saved' => false, 'declaration_period' => nil)
    expect(data['readiness']).to include('filled' => 0, 'total' => 9)
    expect(data['locations']).to contain_exactly(include('branch_id' => branch.prefixed_id, 'tax_head_office' => false))

    patch '/api/v3/admin/pos/tax_profile', headers: headers(writer), params: { signer_name: 'Hiền' }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('store_info_required')
  end

  it 'saves the profile, the shared store fields and the head office for a writer only' do
    Spree::Pos::StoreInfo.create!(store: store, name: 'Quán', phone: '0901234567', business_day_cutoff: '04:00')
    body = { name: 'Hộ kinh doanh Hiền', tax_code: '001234567890', legacy_tax_code: '0312345678', declaration_period: 'month',
             tax_authority_code: '79', industry_code: '9329', business_area_m2: '80', signer_name: 'Hiền',
             cashier_name: 'Lan', locations: [{ branch_id: branch.prefixed_id, tax_location_code: '00001', tax_head_office: true }] }

    patch '/api/v3/admin/pos/tax_profile', headers: headers(reader), params: body, as: :json
    expect(response).to have_http_status(:forbidden)

    patch '/api/v3/admin/pos/tax_profile', headers: headers(writer), params: body, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'TaxProfile')
    data = response.parsed_body['data']
    expect(data).to include('name' => 'Hộ kinh doanh Hiền', 'tax_code' => '001234567890', 'business_area_m2' => '80',
                            'cashier_name' => 'Lan')
    expect(data['readiness']).to eq('filled' => 8, 'total' => 9, 'missing' => ['business_address'])
    expect(data['locations'].first).to include('tax_location_code' => '00001', 'tax_head_office' => true)

    get '/api/v3/admin/pos/store_info', headers: headers(reader)
    expect(response.parsed_body.dig('data', 'name')).to eq('Hộ kinh doanh Hiền')
  end

  it 'returns field errors under the keys the form uses' do
    Spree::Pos::StoreInfo.create!(store: store, name: 'Quán', phone: '0901234567', business_day_cutoff: '04:00')
    patch '/api/v3/admin/pos/tax_profile', headers: headers(writer),
                                           params: { tax_code: '0123', tax_authority_code: 'zz', business_area_m2: 'abc' }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body.dig('error', 'details').keys).to contain_exactly('tax_code', 'tax_authority_code', 'business_area_m2')
  end

  it 'serves the tax catalog with an ETag' do
    get '/api/v3/admin/pos/tax_catalog', headers: headers(reader)
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'TaxCatalog')
    expect(response.parsed_body.dig('data', 'tax_authorities', 'items').size).to eq(34)
    etag = response.headers['ETag']
    get '/api/v3/admin/pos/tax_catalog', headers: headers(reader).merge('If-None-Match' => etag)
    expect(response).to have_http_status(:not_modified)
  end
end
