# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

RSpec.describe 'POS accounting books and tax declarations', type: :request do
  let(:store) { Spree::Store.default }
  let(:password) { 'secret123' }

  before do
    Spree::Pos::TaxRegime.for_store(store).delete_all
  end

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

  it 'computes all 6 TT152/2025/TT-BTC accounting books from live POS data' do
    admin = staff_with(%w[write_pos_topology])
    token = login_as(admin)
    headers = -> { { 'Authorization' => "Bearer #{token}" } }

    stock_location = create(:stock_location)
    branch = Spree::Pos::Branch.create!(
      store: store, stock_location: stock_location, name: 'Chi nhánh chính',
      code: 'main', timezone: 'Asia/Ho_Chi_Minh'
    )
    cash_account = Spree::Pos::FundAccount.create!(
      store: store, branch: branch, name: 'Tiền mặt quầy', kind: 'cash',
      opening_balance: 5_000_000, currency: 'VND', created_by: admin, updated_by: admin
    )

    # Placed order in Nov 2026
    order = create(:order, store: store, status: 'placed', completed_at: Time.zone.parse('2026-11-10 10:00:00'),
                           total: 200_000, item_total: 200_000)

    # Deductible expense (rent) and non-deductible expense (other)
    Spree::Pos::FundVoucher.create!(
      store: store, branch: branch, fund_account: cash_account, actor: admin,
      code: 'PC00001', kind: 'expense', status: 'completed', amount: 50_000, currency: 'VND',
      category_code: 'rent', tax_deductible: true, note: 'Thuê mặt bằng T11',
      occurred_at: Time.zone.parse('2026-11-12 09:00:00')
    )
    Spree::Pos::FundVoucher.create!(
      store: store, branch: branch, fund_account: cash_account, actor: admin,
      code: 'PC00002', kind: 'expense', status: 'completed', amount: 30_000, currency: 'VND',
      category_code: 'other_expense', tax_deductible: false, note: 'Chi phí cá nhân',
      occurred_at: Time.zone.parse('2026-11-13 09:00:00')
    )
    Spree::Pos::FundVoucher.create!(
      store: store, branch: branch, fund_account: cash_account, actor: admin,
      code: 'PT00001', kind: 'income', status: 'completed', amount: 100_000, currency: 'VND',
      category_code: 'sales_other', tax_deductible: true, note: 'Thu khác bán hàng',
      occurred_at: Time.zone.parse('2026-11-14 09:00:00')
    )

    # Overview
    get '/api/v3/admin/pos/accounting_books', headers: headers.call
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['books'].map { |b| b['code'] }).to eq(%w[s1a s2a s2b s2c s2d s2e])

    # S1a, S2a, S2b
    %w[s1a s2a s2b].each do |book_code|
      get "/api/v3/admin/pos/accounting_books/#{book_code}",
          headers: headers.call,
          params: { from: '2026-11-01', to: '2026-11-30' }
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['summary']['total_revenue'].to_d).to eq(200_000)
      expect(body['rows'].size).to eq(1)
      expect(body['rows'].first['document_number']).to eq(order.number)
    end

    # S2c excludes non-deductible expenses (30,000) and includes deductible rent (50,000) + sales_other (100,000)
    get '/api/v3/admin/pos/accounting_books/s2c',
        headers: headers.call,
        params: { from: '2026-11-01', to: '2026-11-30' }
    expect(response).to have_http_status(:ok)
    s2c = response.parsed_body
    expect(s2c['summary']['total_revenue'].to_d).to eq(300_000)
    expect(s2c['summary']['total_deductible_expense'].to_d).to eq(50_000)
    expect(s2c['summary']['total_excluded_expense'].to_d).to eq(30_000)
    expect(s2c['summary']['net_income'].to_d).to eq(250_000)

    # S2d & S2e
    get '/api/v3/admin/pos/accounting_books/s2d',
        headers: headers.call,
        params: { from: '2026-11-01', to: '2026-11-30' }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['book']['code']).to eq('s2d')

    get '/api/v3/admin/pos/accounting_books/s2e',
        headers: headers.call,
        params: { from: '2026-11-01', to: '2026-11-30' }
    expect(response).to have_http_status(:ok)
    s2e = response.parsed_body
    expect(s2e['summary']['total_in'].to_d).to eq(100_000)
    expect(s2e['summary']['total_out'].to_d).to eq(80_000)
    expect(s2e['summary']['closing_balance'].to_d).to eq(5_020_000)
  end

  it 'creates, recalculates, transitions status, and deletes tax declarations (CNKD, VAT, PIT)' do
    admin = staff_with(%w[write_pos_topology])
    emp = staff_with(%w[read_pos_orders])
    token = login_as(admin)
    headers = -> { { 'Authorization' => "Bearer #{token}" } }

    create(:order, store: store, status: 'placed', completed_at: Time.zone.parse('2026-11-15 12:00:00'),
                   total: 1_000_000, item_total: 1_000_000)

    payroll = Spree::Pos::Payroll.create!(
      store: store, code: 'BL0001', name: 'Bảng lương T11', period_label: 'Tháng 11/2026',
      period_start: Date.new(2026, 11, 1), period_end: Date.new(2026, 11, 30),
      payroll_date: Date.new(2026, 11, 25), status: 'finalized', created_by: admin
    )
    payroll.lines.create!(staff: emp, time_amount: 15_000_000, work_days: 26)

    # 1. Create 01/CNKD
    post '/api/v3/admin/pos/tax_declarations', headers: headers.call, params: {
      declaration_type: '01_cnkd',
      period_type: 'quarter',
      period_year: 2026,
      period_number: 4,
      options: { revenue_source: 'all_orders', date_field: 'completed_at', rate_source: 'order_time' }
    }, as: :json
    expect(response).to have_http_status(:created)
    cnkd = response.parsed_body.fetch('declaration')
    expect(cnkd['code']).to eq('TK-CNKD-2026Q4')
    expect(cnkd['summary']['revenue_total'].to_d).to eq(1_000_000)
    expect(cnkd['summary']['total_tax_due'].to_d).to eq(15_000)

    # 2. Recalculate + submit + accept
    post "/api/v3/admin/pos/tax_declarations/#{cnkd['id']}/recalculate", headers: headers.call
    expect(response).to have_http_status(:ok)

    patch "/api/v3/admin/pos/tax_declarations/#{cnkd['id']}", headers: headers.call,
          params: { status: 'submitted' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['declaration']['status']).to eq('submitted')
    expect(response.parsed_body['declaration']['submitted_at']).to be_present

    # 3. Create 04/GTGT and delete draft
    post '/api/v3/admin/pos/tax_declarations', headers: headers.call, params: {
      declaration_type: '04_gtgt', period_type: 'month', period_year: 2026, period_number: 11
    }, as: :json
    expect(response).to have_http_status(:created)
    vat = response.parsed_body.fetch('declaration')
    expect(vat['summary']['output_vat'].to_d).to eq(10_000)

    delete "/api/v3/admin/pos/tax_declarations/#{vat['id']}", headers: headers.call
    expect(response).to have_http_status(:no_content)

    # 4. Create 05/KK-TNCN from payroll
    post '/api/v3/admin/pos/tax_declarations', headers: headers.call, params: {
      declaration_type: '05_kk_tncn', period_type: 'month', period_year: 2026, period_number: 11
    }, as: :json
    expect(response).to have_http_status(:created)
    pit = response.parsed_body.fetch('declaration')
    expect(pit['summary']['employee_count']).to eq(1)
    expect(pit['summary']['gross_income_total'].to_d).to eq(15_000_000)
    expect(pit['summary']['total_tax_due'].to_d).to eq(200_000) # (15M - 11M) * 5%

    # 5. List filtered by group
    get '/api/v3/admin/pos/tax_declarations', headers: headers.call, params: { group: 'cnkd' }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['declarations'].map { |d| d['code'] }).to eq(['TK-CNKD-2026Q4'])
  end
end
