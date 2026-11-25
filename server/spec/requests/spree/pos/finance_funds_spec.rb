# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_credit_helpers'

RSpec.describe 'POS finance (fund accounts, vouchers, quick QR, receivable enhancements)', type: :request do
  include PosCreditHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:resolver) do
    credit_staff(
      store,
      branch,
      PosCreditHelpers::MANAGER + [Spree::Pos::Capabilities::RESOLVE, Spree::Pos::Capabilities::CREDIT_SELL],
      extra_permissions: %w[write_pos_topology]
    )
  end
  let(:collector) { credit_staff(store, branch, [Spree::Pos::Capabilities::PAYMENT]) }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def call(user, verb, path, body = {})
    key = SecureRandom.uuid
    send(
      verb,
      "/api/v3/admin/pos/#{path}",
      headers: { 'Authorization' => "Bearer #{token_for(user)}", 'Idempotency-Key' => key },
      params: verb == :get ? body : body.merge(idempotency_key: key),
      as: verb == :get ? nil : :json
    )
    response.parsed_body
  end

  describe 'fund accounts and internal transfers' do
    it 'auto-creates default cash account, allows creating/updating accounts, and tracks transfer balances' do
      res = call(collector, :get, 'fund_accounts', { branch_id: branch.prefixed_id })
      expect(response).to have_http_status(:ok)
      expect(res['data'].length).to eq(1)
      cash = res['data'].first
      expect(cash).to include('name' => 'Tiền mặt', 'kind' => 'cash', 'current_balance' => '0.0')

      # Collector cannot create accounts
      call(collector, :post, 'fund_accounts', { branch_id: branch.prefixed_id, name: 'VIB', kind: 'bank' })
      expect(response).to have_http_status(:forbidden)

      # Resolver updates cash opening balance
      updated = call(resolver, :patch, "fund_accounts/#{cash['id']}", { opening_balance: '1000000' })['data']
      expect(response).to have_http_status(:ok)
      expect(updated['opening_balance']).to eq('1000000.0')

      # Resolver creates bank account
      bank = call(resolver, :post, 'fund_accounts', {
        branch_id: branch.prefixed_id, name: 'VIB **96', kind: 'bank',
        bank_name: 'VIB', account_number: '0389450596', opening_balance: '500000'
      })['data']
      expect(response).to have_http_status(:created)
      expect(bank['kind']).to eq('bank')

      # Internal transfer from cash -> bank
      transfer = call(resolver, :post, 'fund_accounts/transfer', {
        branch_id: branch.prefixed_id, from_account_id: cash['id'], to_account_id: bank['id'],
        amount: '300000', note: 'Nộp tiền mặt vào ngân hàng'
      })['data']
      expect(response).to have_http_status(:created)
      expect(transfer['kind']).to eq('transfer')
      expect(transfer['code']).to start_with('CK')

      # Verify resulting balances
      after = call(resolver, :get, 'fund_accounts', { branch_id: branch.prefixed_id })
      by_id = after['data'].index_by { |r| r['id'] }
      expect(by_id[cash['id']]['current_balance']).to eq('700000.0')
      expect(by_id[bank['id']]['current_balance']).to eq('800000.0')
      expect(after.dig('meta', 'total_balance')).to eq('1500000.0')
    end
  end

  describe 'fund vouchers (income/expense) and voiding' do
    it 'creates income/expense vouchers with TT152 categories, summarizes KPIs, filters, and voids cleanly' do
      cash = call(resolver, :get, 'fund_accounts', { branch_id: branch.prefixed_id })['data'].first

      income = call(resolver, :post, 'fund_vouchers', {
        branch_id: branch.prefixed_id, kind: 'income', fund_account_id: cash['id'],
        amount: '500000', category_code: 'other_income', counterparty_name: 'Anh Minh', note: 'Thu ngoài đơn'
      })['data']
      expect(response).to have_http_status(:created)
      expect(income['code']).to start_with('PT')

      expense = call(resolver, :post, 'fund_vouchers', {
        branch_id: branch.prefixed_id, kind: 'expense', fund_account_id: cash['id'],
        amount: '120000', category_code: 'electricity', tax_deductible: false,
        counterparty_name: 'EVN', note: 'Tiền điện tháng 11'
      })['data']
      expect(response).to have_http_status(:created)
      expect(expense['code']).to start_with('PC')
      expect(expense['tax_deductible']).to eq(false)

      list = call(resolver, :get, 'fund_vouchers', { branch_id: branch.prefixed_id })
      expect(response).to have_http_status(:ok)
      expect(list['data'].length).to eq(2)
      expect(list.dig('meta', 'summary')).to include(
        'total_income' => '500000.0', 'total_expense' => '120000.0', 'net_change' => '380000.0'
      )

      # Filter by search and kind
      filtered = call(resolver, :get, 'fund_vouchers', { branch_id: branch.prefixed_id, kind: 'expense', search: 'EVN' })
      expect(filtered['data'].map { |r| r['id'] }).to eq([expense['id']])

      # Void expense voucher -> balance & summary update
      voided = call(resolver, :post, "fund_vouchers/#{expense['id']}/void", { reason: 'Nhập nhầm số tiền' })['data']
      expect(response).to have_http_status(:ok)
      expect(voided['status']).to eq('voided')
      expect(voided['void_reason']).to eq('Nhập nhầm số tiền')

      after = call(resolver, :get, 'fund_vouchers', { branch_id: branch.prefixed_id })
      expect(after.dig('meta', 'summary')).to include('total_income' => '500000.0', 'total_expense' => '0.0', 'net_change' => '500000.0')
    end

    it 'returns available: false for quick_qr when VietQR is not configured' do
      res = call(collector, :post, 'fund_vouchers/quick_qr', { branch_id: branch.prefixed_id, amount: '250000' })
      expect(response).to have_http_status(:ok)
      expect(res.dig('data', 'available')).to eq(false)
    end
  end

  describe 'receivable enhancements (promised_pay_on, ledger, settled customers)' do
    it 'sets promised_pay_on, returns chronological running ledger, and lists settled customers' do
      profile = credit_customer(store, resolver)
      account_data = call(resolver, :post, 'credit_accounts', {
        branch_id: branch.prefixed_id, customer_id: profile.prefixed_id, credit_limit: '1000000', due_days: 15
      })['data']
      expect(response).to have_http_status(:created)

      # Create a credit sale (cashier differs from approver due to dual control)
      cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)
      sale = credit_sale(store, branch, price: 300_000, cashier: cashier)
      assign(sale, profile)
      workspace = sale.workspace.reload
      approval = call(resolver, :post, "workspaces/#{workspace.prefixed_id}/credit_approvals", {
        requester_id: sale.cashier.prefixed_id, amount: '300000', revision: workspace.revision
      })['data']
      expect(response).to have_http_status(:created)
      call(sale.cashier, :post, "workspaces/#{workspace.prefixed_id}/complete", {
        expected_revision: workspace.revision, lease_generation: workspace.lease_generation,
        editor_id: sale.editor_id, credit_approval_id: approval['approval_id']
      })
      expect(response).to have_http_status(:ok)

      # Set promised_pay_on
      promised = call(resolver, :patch, "receivables/customers/#{account_data['id']}/promised_pay_on", {
        branch_id: branch.prefixed_id, promised_pay_on: '2026-12-05'
      })['data']
      expect(response).to have_http_status(:ok)
      expect(promised['promised_pay_on']).to eq('2026-12-05')

      # Check customers list includes promised_pay_on and counts
      customers = call(resolver, :get, 'receivables/customers', { branch_id: branch.prefixed_id })
      expect(customers['data'].first['promised_pay_on']).to eq('2026-12-05')
      expect(customers['meta']).to include('open_count' => 1, 'settled_count' => 0)

      # Check running balance ledger
      ledger = call(resolver, :get, "receivables/customers/#{account_data['id']}/ledger", { branch_id: branch.prefixed_id })
      expect(response).to have_http_status(:ok)
      expect(ledger['data'].length).to eq(1)
      expect(ledger['data'].first).to include('kind' => 'debit', 'amount' => '300000.0', 'balance_after' => '300000.0')
      expect(ledger['meta']).to include('total_debited' => '300000.0', 'current_balance' => '300000.0')

      # Clear promised_pay_on
      cleared = call(resolver, :patch, "receivables/customers/#{account_data['id']}/promised_pay_on", {
        branch_id: branch.prefixed_id, promised_pay_on: ''
      })['data']
      expect(cleared['promised_pay_on']).to be_nil
    end
  end
end
