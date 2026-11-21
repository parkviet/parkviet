# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

# The sample selling screen a branch opens with, set through the branch API
# and read back through the branch list and the POS context.
RSpec.describe 'POS branch selling preset', type: :request, pos_modules: :default do
  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }
  let(:branch) do
    Spree::Pos::Branch.create!(store: store, stock_location: create(:stock_location, store: store), name: 'Quầy',
                               code: "q#{SecureRandom.hex(3)}", timezone: 'Asia/Ho_Chi_Minh')
  end

  def headers_for(permissions)
    user = create(:admin_user, :without_admin_role, password: password)
    create(:role_user, user: user, role: create(:role, resource: store, permissions: permissions))
    post '/api/v3/admin/auth/login', params: { email: user.email, password: password }, as: :json
    { 'Authorization' => "Bearer #{response.parsed_body.fetch('token')}" }
  end

  def update(preset, headers: headers_for(%w[write_pos_topology read_pos_topology]))
    patch "/api/v3/admin/pos/branches/#{branch.prefixed_id}", headers: headers, params: { selling_preset: preset }, as: :json
  end

  it 'starts with no preset, so the POS derives the screen from the modules' do
    expect(branch.selling_preset).to be_nil
    get "/api/v3/admin/pos/branches/#{branch.prefixed_id}", headers: headers_for(%w[read_pos_topology])
    expect(response.parsed_body['data']).to include('selling_preset' => nil)
  end

  it 'saves a preset every branch may use, reads it back and clears it with a blank value' do
    update('big_menu')
    expect(response).to have_http_status(:ok), response.body
    expect(response.parsed_body['data']).to include('selling_preset' => 'big_menu')
    expect(branch.reload.selling_preset).to eq('big_menu')

    get '/api/v3/admin/pos/branches', headers: headers_for(%w[read_pos_topology])
    row = response.parsed_body['data'].find { |item| item['id'] == branch.prefixed_id }
    expect(row).to include('selling_preset' => 'big_menu')

    update('')
    expect(response).to have_http_status(:ok)
    expect(branch.reload.selling_preset).to be_nil
  end

  it 'refuses a screen the POS does not have' do
    update('kiosk')
    expect(response).to have_http_status(:conflict)
    expect(branch.reload.selling_preset).to be_nil
  end

  it 'allows tables first only while the branch has the table module on' do
    update('tables_first')
    expect(response).to have_http_status(:unprocessable_content)
    expect(branch.reload.selling_preset).to be_nil

    set_pos_module(branch, 'fnb.tables', true)
    update('tables_first')
    expect(response).to have_http_status(:ok), response.body
    expect(branch.reload.selling_preset).to eq('tables_first')

    # Turning the module off later does not make the branch unsavable.
    set_pos_module(branch, 'fnb.tables', false)
    patch "/api/v3/admin/pos/branches/#{branch.prefixed_id}", headers: headers_for(%w[write_pos_topology]),
                                                              params: { name: 'Quầy chính' }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect(branch.reload).to have_attributes(name: 'Quầy chính', selling_preset: 'tables_first')
  end

  it 'needs topology write access' do
    update('quick', headers: headers_for(%w[read_pos_topology]))
    expect(response).to have_http_status(:forbidden)
    expect(branch.reload.selling_preset).to be_nil
  end
end
