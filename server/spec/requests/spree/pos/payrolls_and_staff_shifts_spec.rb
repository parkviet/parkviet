# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

RSpec.describe 'POS payrolls and staff shifts', type: :request do
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

  it 'creates, edits, finalizes, reopens, and deletes payrolls with VN accounting calculations' do
    admin = staff_with(%w[write_pos_topology])
    emp1 = staff_with(%w[read_pos_orders])
    emp2 = staff_with(%w[read_pos_orders])
    token = login_as(admin)
    headers = -> { { 'Authorization' => "Bearer #{token}" } }

    # 1. Create draft payroll with 2 employees
    post '/api/v3/admin/pos/payrolls', headers: headers.call, params: {
      name: 'Bảng lương tháng 11/2026',
      period_label: 'Tháng 11/2026',
      period_start: '2026-11-01',
      period_end: '2026-11-30',
      payroll_date: '2026-11-25',
      staff_ids: [emp1.prefixed_id, emp2.prefixed_id]
    }, as: :json
    expect(response).to have_http_status(:created)
    payroll = response.parsed_body.fetch('data')
    expect(payroll['code']).to eq('BL0001')
    expect(payroll['status']).to eq('draft')
    expect(payroll['lines'].size).to eq(2)
    payroll_id = payroll['id']

    # 2. Update lines with salary, allowances, deductions, employer costs
    patch "/api/v3/admin/pos/payrolls/#{payroll_id}", headers: headers.call, params: {
      lines: [
        {
          staff_id: emp1.prefixed_id,
          work_days: 26,
          time_amount: 10_000_000,
          payroll_allowance: 1_000_000,
          bonus: 500_000,
          employee_bhxh: 800_000,
          employee_bhyt: 150_000,
          employee_bhtn: 100_000,
          pit_tax: 200_000,
          employer_bhxh: 1_750_000,
          employer_bhyt: 300_000,
          employer_bhtn: 100_000
        }
      ]
    }, as: :json
    expect(response).to have_http_status(:ok)
    updated = response.parsed_body.fetch('data')
    expect(updated['lines'].size).to eq(1)
    line = updated['lines'].first
    expect(line['gross_amount'].to_d).to eq(11_500_000)
    expect(line['total_deductions'].to_d).to eq(1_250_000)
    expect(line['net_amount'].to_d).to eq(10_250_000)
    expect(updated['total_gross'].to_d).to eq(11_500_000)
    expect(updated['total_net'].to_d).to eq(10_250_000)
    expect(updated['total_employer_cost'].to_d).to eq(2_150_000)

    # 3. List payrolls returns next_code BL0002
    get '/api/v3/admin/pos/payrolls', headers: headers.call, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('meta', 'next_code')).to eq('BL0002')

    # 4. Finalize locks edits until reopened
    post "/api/v3/admin/pos/payrolls/#{payroll_id}/finalize", headers: headers.call, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'status')).to eq('finalized')

    patch "/api/v3/admin/pos/payrolls/#{payroll_id}", headers: headers.call, params: { name: 'Blocked' }, as: :json
    expect(response).to have_http_status(:conflict)

    post "/api/v3/admin/pos/payrolls/#{payroll_id}/reopen", headers: headers.call, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'status')).to eq('draft')

    # 5. Delete payroll
    delete "/api/v3/admin/pos/payrolls/#{payroll_id}", headers: headers.call, as: :json
    expect(response).to have_http_status(:no_content)
  end

  it 'lists store-wide staff shifts with branch, staff, and date filters' do
    admin = staff_with(%w[write_pos_topology])
    cashier = staff_with(%w[read_pos_orders])
    location = create(:stock_location, store: store, backorderable_default: false)
    branch = Spree::Pos::Branch.create!(
      store: store,
      stock_location: location,
      name: 'Chi nhánh 1',
      code: 'cn1',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'active'
    )
    shift = Spree::Pos::Shift.create!(
      store: store,
      branch: branch,
      owner: cashier,
      opening_float: 500_000,
      currency: 'VND',
      status: 'open',
      opened_at: 2.hours.ago,
      business_date: Date.current
    )

    token = login_as(admin)
    get '/api/v3/admin/pos/staff_shifts',
        headers: { 'Authorization' => "Bearer #{token}" },
        params: { branch_id: branch.prefixed_id, staff_id: cashier.prefixed_id },
        as: :json
    expect(response).to have_http_status(:ok)
    rows = response.parsed_body.fetch('data')
    expect(rows.map { |r| r['id'] }).to include(shift.prefixed_id)
    expect(rows.first['staff_email']).to eq(cashier.email)
    expect(response.parsed_body.dig('meta', 'summary', 'open')).to eq(1)
  end
end
