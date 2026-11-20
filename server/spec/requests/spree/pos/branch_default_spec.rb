# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

# Setting a store's default branch through the branch update API.
RSpec.describe 'POS default branch', type: :request do
  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }

  def headers_for(permissions)
    user = create(:admin_user, :without_admin_role, password: password)
    create(:role_user, user: user, role: create(:role, resource: store, permissions: permissions))
    post '/api/v3/admin/auth/login', params: { email: user.email, password: password }, as: :json
    { 'Authorization' => "Bearer #{response.parsed_body.fetch('token')}" }
  end

  def branch!(status: 'active')
    Spree::Pos::Branch.create!(store: store, stock_location: create(:stock_location, store: store), name: 'Quầy',
                               code: "q#{SecureRandom.hex(3)}", timezone: 'Asia/Ho_Chi_Minh', status: status)
  end

  it 'moves the default to the branch named, and lists the flag' do
    first = branch!
    second = branch!
    headers = headers_for(%w[write_pos_topology read_pos_topology])

    patch "/api/v3/admin/pos/branches/#{second.prefixed_id}", headers: headers, params: { is_default: true }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect(response.parsed_body['data']).to include('is_default' => true)
    expect(first.reload).not_to be_is_default

    get '/api/v3/admin/pos/branches', headers: headers
    flags = response.parsed_body['data'].to_h { |row| [row['id'], row['is_default']] }
    expect(flags).to eq(first.prefixed_id => false, second.prefixed_id => true)
  end

  it 'refuses a disabled branch and an unset of the only default' do
    first = branch!
    disabled = branch!(status: 'disabled')
    headers = headers_for(%w[write_pos_topology])

    patch "/api/v3/admin/pos/branches/#{disabled.prefixed_id}", headers: headers, params: { is_default: true }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(disabled.reload).not_to be_is_default

    patch "/api/v3/admin/pos/branches/#{first.prefixed_id}", headers: headers, params: { is_default: false }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('default_branch_required')
    expect(first.reload).to be_is_default
  end

  it 'needs topology write access' do
    first = branch!
    second = branch!
    patch "/api/v3/admin/pos/branches/#{second.prefixed_id}", headers: headers_for(%w[read_pos_topology]), params: { is_default: true }, as: :json
    expect(response).to have_http_status(:forbidden)
    expect(first.reload).to be_is_default
  end

  it 'makes the first branch created through the API the default' do
    headers = headers_for(%w[write_pos_topology])
    post '/api/v3/admin/pos/branches', headers: headers, params: {
      name: 'Quan 1', code: 'q1', timezone: 'Asia/Ho_Chi_Minh', stock_location_id: create(:stock_location, store: store).prefixed_id
    }, as: :json
    expect(response).to have_http_status(:created), response.body
    expect(response.parsed_body['data']).to include('is_default' => true)
  end
end
