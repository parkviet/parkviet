# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

RSpec.describe 'POS Danger Zone', type: :request do
  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }

  def login_as(user)
    post '/api/v3/admin/auth/login', params: { email: user.email, password: password }, as: :json
    response.parsed_body.fetch('token')
  end

  def staff_with(permissions)
    user = create(:admin_user, :without_admin_role, password: password)
    role = create(:role, resource: store, permissions: permissions)
    create(:role_user, user: user, role: role)
    user
  end

  def create_branch(name:, code:)
    loc = create(:stock_location, store: store)
    Spree::Pos::Branch.create!(
      store: store,
      stock_location: loc,
      name: name,
      code: code,
      timezone: 'Asia/Ho_Chi_Minh'
    )
  end

  it 'wipes a single branch without affecting another branch or staff' do
    admin = staff_with(%w[write_pos_topology])
    token = login_as(admin)
    headers = { 'Authorization' => "Bearer #{token}" }

    branch_a = create_branch(name: 'Chi nhánh A', code: 'branch_a')
    branch_b = create_branch(name: 'Chi nhánh B', code: 'branch_b')

    acc_a = Spree::Pos::FundAccount.create!(
      store: store, branch: branch_a, name: 'Quỹ A', kind: 'cash',
      opening_balance: 1_000_000, currency: 'VND', created_by: admin, updated_by: admin
    )
    acc_b = Spree::Pos::FundAccount.create!(
      store: store, branch: branch_b, name: 'Quỹ B', kind: 'cash',
      opening_balance: 2_000_000, currency: 'VND', created_by: admin, updated_by: admin
    )

    voucher_a = Spree::Pos::FundVoucher.create!(
      store: store, branch: branch_a, fund_account: acc_a, actor: admin,
      code: 'PTA001', kind: 'income', status: 'completed', amount: 150_000, currency: 'VND',
      category_code: 'sales_other', occurred_at: Time.current
    )
    voucher_b = Spree::Pos::FundVoucher.create!(
      store: store, branch: branch_b, fund_account: acc_b, actor: admin,
      code: 'PTB001', kind: 'income', status: 'completed', amount: 250_000, currency: 'VND',
      category_code: 'sales_other', occurred_at: Time.current
    )

    # Wrong confirmation is rejected
    post '/api/v3/admin/pos/store_info/reset_data',
         params: { scope: 'branch', branch_id: branch_a.prefixed_id, wipe_transactions: true, confirmation: 'Wrong Name' },
         headers: headers, as: :json
    expect(response).to have_http_status(:conflict)
    expect(Spree::Pos::FundVoucher.exists?(voucher_a.id)).to be(true)

    # Correct confirmation wipes only branch A
    post '/api/v3/admin/pos/store_info/reset_data',
         params: {
           scope: 'branch',
           branch_id: branch_a.prefixed_id,
           wipe_transactions: true,
           wipe_catalog: true,
           confirmation: 'Chi nhánh A'
         },
         headers: headers, as: :json

    expect(response).to have_http_status(:ok)
    body = response.parsed_body.fetch('data')
    expect(body['scope']).to eq('branch')
    expect(body['branch_id']).to eq(branch_a.prefixed_id)
    expect(body['preserved_staff']).to be(true)
    expect(body.dig('deleted_counts', 'transactions')).to be >= 1

    # Branch A voucher gone, Branch B voucher preserved, branches & staff preserved
    expect(Spree::Pos::FundVoucher.exists?(voucher_a.id)).to be(false)
    expect(Spree::Pos::FundVoucher.exists?(voucher_b.id)).to be(true)
    expect(Spree::Pos::Branch.exists?(branch_a.id)).to be(true)
    expect(Spree::Pos::Branch.exists?(branch_b.id)).to be(true)
    expect(Spree::AdminUser.exists?(admin.id)).to be(true)
  end

  it 'deletes a single branch cleanly and promotes another default branch' do
    admin = staff_with(%w[write_pos_topology])
    token = login_as(admin)
    headers = { 'Authorization' => "Bearer #{token}" }

    branch_a = create_branch(name: 'Chi nhánh chính', code: 'main_del')
    branch_b = create_branch(name: 'Chi nhánh phụ', code: 'sub_keep')
    expect(branch_a.reload.is_default).to be(true)

    acc_a = Spree::Pos::FundAccount.create!(
      store: store, branch: branch_a, name: 'Quỹ chính', kind: 'cash',
      opening_balance: 500_000, currency: 'VND', created_by: admin, updated_by: admin
    )
    Spree::Pos::FundVoucher.create!(
      store: store, branch: branch_a, fund_account: acc_a, actor: admin,
      code: 'PTDEL01', kind: 'income', status: 'completed', amount: 100_000, currency: 'VND',
      category_code: 'sales_other', occurred_at: Time.current
    )

    post '/api/v3/admin/pos/store_info/delete_branch',
         params: { branch_id: branch_a.prefixed_id, confirmation: 'Chi nhánh chính' },
         headers: headers, as: :json

    expect(response).to have_http_status(:ok)
    body = response.parsed_body.fetch('data')
    expect(body['deleted_branch_id']).to eq(branch_a.prefixed_id)
    expect(body['remaining_branches_count']).to eq(1)

    expect(Spree::Pos::Branch.exists?(branch_a.id)).to be(false)
    expect(Spree::Pos::Branch.exists?(branch_b.id)).to be(true)
    expect(branch_b.reload.is_default).to be(true)
    expect(Spree::AdminUser.exists?(admin.id)).to be(true)
  end

  it 'refuses deleting the only active store and deletes when another store exists' do
    admin = staff_with(%w[write_pos_topology])
    token = login_as(admin)
    headers = { 'Authorization' => "Bearer #{token}" }

    # Only 1 store -> rejected
    post '/api/v3/admin/pos/store_info/delete_store',
         params: { confirmation: store.name },
         headers: headers, as: :json
    expect(response).to have_http_status(:conflict)

    # Create second store -> now deletion succeeds
    second_store = create(:store, name: 'Cửa hàng dự phòng')
    post '/api/v3/admin/pos/store_info/delete_store',
         params: { confirmation: store.name },
         headers: headers, as: :json
    expect(response).to have_http_status(:ok)
    body = response.parsed_body.fetch('data')
    expect(body['deleted_store_id']).to eq(store.prefixed_id)
    expect(body['next_store_id']).to eq(second_store.prefixed_id)
    expect(store.reload.deleted_at).to be_present
    expect(second_store.reload.default).to be(true)
  end
end
