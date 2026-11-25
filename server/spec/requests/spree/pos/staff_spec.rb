# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

RSpec.describe 'POS staff directory', type: :request do
  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }

  def login_as(user)
    post '/api/v3/admin/auth/login', params: { email: user.email, password: password }, as: :json
    response.parsed_body.fetch('token')
  end

  def staff_with(permissions, target_store = store)
    user = create(:admin_user, :without_admin_role, password: password)
    role = create(:role, resource: target_store, permissions: permissions)
    create(:role_user, user: user, role: role)
    user
  end

  def create_branch(name:, code:)
    location = create(:stock_location, store: store, backorderable_default: false)
    Spree::Pos::Branch.create!(
      store: store,
      stock_location: location,
      name: name,
      code: code,
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'active'
    )
  end

  it 'creates unassigned staff, filters unassigned, assigns to branches, updates, and toggles status' do
    admin = staff_with(%w[write_pos_topology])
    branch_a = create_branch(name: 'Chi nhánh A', code: 'cna')
    branch_b = create_branch(name: 'Chi nhánh B', code: 'cnb')
    cashier_role = Spree::Pos::StaffRole.create!(
      store: store,
      name: 'Thu ngân',
      capabilities: ['pos.shift.open', 'pos.payment.collect'],
      status: 'active'
    )
    token = login_as(admin)
    headers = -> { { 'Authorization' => "Bearer #{token}" } }

    # 1. Create a staff member WITHOUT assigning any branch
    post '/api/v3/admin/pos/staff', headers: headers.call, params: {
      first_name: 'Nguyễn',
      last_name: 'An',
      email: 'nguyen.an@example.com',
      password: 'password123'
    }, as: :json
    expect(response).to have_http_status(:created), "body: #{response.body}"
    created = response.parsed_body.fetch('data')
    expect(created['email']).to eq('nguyen.an@example.com')
    expect(created['status']).to eq('active')
    expect(created['memberships']).to eq([])
    staff_id = created['id']

    # 2. Newly created staff appears in unassigned filter & configuration/staff
    get '/api/v3/admin/pos/staff', headers: headers.call, params: { branch_id: 'unassigned' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['data'].map { |r| r['id'] }).to include(staff_id)
    expect(response.parsed_body.dig('meta', 'summary', 'unassigned')).to be >= 1

    get '/api/v3/admin/pos/configuration/staff', headers: headers.call, params: { q: 'nguyen.an' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['data'].map { |r| r['id'] }).to include(staff_id)

    # 3. Assign the staff member to branch A via memberships API
    post '/api/v3/admin/pos/memberships', headers: headers.call, params: {
      branch_id: branch_a.prefixed_id,
      staff_id: staff_id,
      staff_role_id: cashier_role.prefixed_id,
      capabilities: []
    }, as: :json
    expect(response).to have_http_status(:created)

    # 4. Staff now appears under branch_a filter and includes the membership
    get '/api/v3/admin/pos/staff', headers: headers.call, params: { branch_id: branch_a.prefixed_id }, as: :json
    expect(response).to have_http_status(:ok)
    row = response.parsed_body['data'].find { |r| r['id'] == staff_id }
    expect(row).to be_present
    expect(row['memberships'].size).to eq(1)
    expect(row['memberships'].first['branch_id']).to eq(branch_a.prefixed_id)
    expect(row['memberships'].first.dig('staff_role', 'name')).to eq('Thu ngân')

    # 5. Create another staff WITH immediate branch assignment to branch B
    post '/api/v3/admin/pos/staff', headers: headers.call, params: {
      first_name: 'Trần',
      last_name: 'Bình',
      email: 'tran.binh@example.com',
      password: 'password123',
      memberships: [
        { branch_id: branch_b.prefixed_id, staff_role_id: cashier_role.prefixed_id }
      ]
    }, as: :json
    expect(response).to have_http_status(:created), "body: #{response.body}"
    expect(response.parsed_body.dig('data', 'memberships').size).to eq(1)
    expect(response.parsed_body.dig('data', 'memberships', 0, 'branch_id')).to eq(branch_b.prefixed_id)

    # 6. Update profile, disable and re-enable
    patch "/api/v3/admin/pos/staff/#{staff_id}", headers: headers.call, params: {
      first_name: 'Nguyễn Văn',
      last_name: 'An'
    }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'first_name')).to eq('Nguyễn Văn')

    post "/api/v3/admin/pos/staff/#{staff_id}/disable", headers: headers.call, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'status')).to eq('disabled')

    post "/api/v3/admin/pos/staff/#{staff_id}/enable", headers: headers.call, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'status')).to eq('active')

    # 7. Cannot disable own account
    post "/api/v3/admin/pos/staff/#{admin.prefixed_id}/disable", headers: headers.call, as: :json
    expect(response).to have_http_status(:conflict)

    # 8. Non-topology staff is forbidden
    cashier = staff_with(%w[read_pos_orders])
    get '/api/v3/admin/pos/staff', headers: { 'Authorization' => "Bearer #{login_as(cashier)}" }, as: :json
    expect(response).to have_http_status(:forbidden)
  end
end
