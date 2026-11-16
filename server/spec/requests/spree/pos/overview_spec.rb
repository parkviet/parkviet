# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_shift_helpers'
require_relative '../../../support/pos_schema_helpers'

# The dashboard home page read: sales figures from the sales report over
# business dates, the previous period, best sellers that returns never
# reduce, order status counts, stock alerts, and the report's own scope.
RSpec.describe 'POS overview API', type: :request do
  include PosShiftHelpers
  include PosSchemaHelpers
  include ActiveSupport::Testing::TimeHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD) }
  let(:colleague) { credit_staff(store, branch, PosShiftHelpers::LEAD) }
  let(:reader) { credit_staff(store, branch, PosShiftHelpers::MANAGER + [Spree::Pos::Capabilities::REPORT_READ]) }
  let(:zone) { ActiveSupport::TimeZone[branch.timezone] }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def fetch(user, path, **query)
    get "/api/v3/admin/pos/#{path}", headers: { 'Authorization' => "Bearer #{token_for(user)}" },
                                     params: { branch_id: branch.prefixed_id }.merge(query)
    response.parsed_body
  end

  def overview(user, **query)
    fetch(user, 'overview', **query)['data']
  end

  def business_today
    Spree::Pos::BusinessDay.for(branch, Spree::Pos::Workspace.business_now).to_date
  end

  describe 'figures' do
    it 'matches the sales report and keeps returned lines in the best sellers' do
      product = stocked_product(store, branch, price: 25_000)
      sold = paid_sale(store, branch, cashier: cashier, price: 25_000, product: product, quantity: 3)
      paid_sale(store, branch, cashier: colleague, price: 90_000)
      return_and_receive(store, reader, branch, sold, quantity: 1)
      days = [business_today, Time.now.in_time_zone(branch.timezone).to_date]
      range = { from: days.min.iso8601, to: days.max.iso8601 }

      summary = fetch(reader, 'reports/sales', **range).dig('meta', 'summary')
      data = overview(reader, **range)
      expect(response).to have_http_status(:ok)
      expect_pos_schema!(response, 'Overview')
      expect(data['totals']).to eq(summary.except('by_source').merge('customers' => summary['orders']))
      expect(data['totals']).to include('orders' => 2, 'sales_total' => '165000.0', 'returns_total' => '25000.0',
                                        'net_sales' => '140000.0')
      expect(data['by_source']).to eq(summary['by_source'])
      expect(data['by_hour'].sum { |row| row['orders'] }).to eq(2)
      expect(data['previous_totals']).to be_nil
      expect(data['previous_by_day']).to be_nil
      expect(data['by_day'].sum { |row| row['orders'] }).to eq(2)
      expect(data['by_day'].sum { |row| BigDecimal(row['returns_total']) }).to eq(25_000)
      expect(data['by_day'].sum { |row| BigDecimal(row['net_sales']) }).to eq(140_000)

      top = data.dig('top_items', 'by_quantity')
      expect(top.first).to include('variant_id' => product.default_variant.prefixed_id, 'quantity' => 3, 'revenue' => '75000.0')
      expect(data.dig('top_items', 'by_revenue').map { |row| row['revenue'] }).to eq(['90000.0', '75000.0'])
      expect(data['status_counts']).to eq('all' => 2, 'debt' => 0, 'returned' => 1, 'refund_pending' => 0)
      expect(data['scope']).to eq('branch')
    end

    it 'counts stock alerts and lots expiring soon for readers of the stock alert page' do
      empty = stocked_product(store, branch, price: 10_000, stock: 1)
      branch.stock_location.unstock(empty.default_variant, 1)
      short = stocked_product(store, branch, price: 10_000, stock: 2)
      plenty = stocked_product(store, branch, price: 10_000, stock: 50)
      [[empty, 5], [short, 5], [plenty, 5]].each do |product, minimum|
        Spree::Pos::StockAlert.create!(store: store, branch: branch, variant: product.default_variant, min_quantity: minimum)
      end
      today = Spree::Pos::StockIntegration.today(branch)
      [['SOON', today + 10, 4], ['LATER', today + 90, 4], ['GONE', today + 5, 0]].each do |code, expiry, quantity|
        Spree::Pos::InventoryLot.create!(store: store, variant: plenty.default_variant, stock_location: branch.stock_location,
                                         lot_code: code, expiry_on: expiry, received_quantity: 4, on_hand: quantity)
      end

      expect(overview(reader)['stock_alerts']).to eq('out_of_stock' => 1, 'low_stock' => 1, 'expiring_soon' => 1,
                                                     'near_expiry_days' => 30)
      expect(overview(cashier)['stock_alerts']).to be_nil
    end
  end

  describe 'customers' do
    it 'counts a registered customer once a day and every walk-in order as a visit' do
      lan = Spree::Pos::CustomerProfile.create!(store: store, name: 'Chị Lan', phone: '0901234567', created_by: cashier)
      travel_to zone.local(2026, 11, 5, 10, 0)
      2.times { paid_sale(store, branch, cashier: cashier, price: 10_000).workspace.update_columns(pos_customer_id: lan.id) }
      2.times { paid_sale(store, branch, cashier: cashier, price: 10_000) }
      travel_to zone.local(2026, 11, 6, 10, 0)
      paid_sale(store, branch, cashier: cashier, price: 10_000).workspace.update_columns(pos_customer_id: lan.id)
      travel_back

      data = overview(reader, from: '2026-11-05', to: '2026-11-06')
      rows = data['by_day'].map { |row| [row['date'], row['orders'], row['customers']] }
      expect(rows).to eq([['2026-11-05', 4, 3], ['2026-11-06', 1, 1]])
      # Over the period the same customer still counts once.
      expect(data['totals']).to include('orders' => 5, 'customers' => 3)

      previous = overview(reader, from: '2026-11-07', to: '2026-11-07', compare: '1')
      expect(previous['previous_totals']).to include('orders' => 1, 'customers' => 1)
      expect(previous['previous_by_day']).to eq([{ 'date' => '2026-11-06', 'orders' => 1, 'customers' => 1, 'sales_total' => '10000.0',
                                                   'returns_total' => '0.0', 'net_sales' => '10000.0' }])
    ensure
      travel_back
    end
  end

  describe 'dates' do
    it 'puts sales on their business date, fills empty days and compares the period before' do
      travel_to zone.local(2026, 11, 3, 12, 0)
      paid_sale(store, branch, cashier: cashier, price: 15_000)
      travel_to zone.local(2026, 11, 5, 23, 30)
      paid_sale(store, branch, cashier: cashier, price: 30_000)
      travel_to zone.local(2026, 11, 6, 0, 30)
      paid_sale(store, branch, cashier: cashier, price: 20_000)
      travel_back

      data = overview(reader, from: '2026-11-05', to: '2026-11-06', compare: '1')
      expect_pos_schema!(response, 'Overview')
      # 00:30 is before the 04:00 cutoff, so both late sales belong to 5 November.
      expect(data['by_day']).to eq([
                                     { 'date' => '2026-11-05', 'orders' => 2, 'customers' => 2, 'sales_total' => '50000.0',
                                       'returns_total' => '0.0', 'net_sales' => '50000.0' },
                                     { 'date' => '2026-11-06', 'orders' => 0, 'customers' => 0, 'sales_total' => '0.0',
                                       'returns_total' => '0.0', 'net_sales' => '0.0' }
                                   ])
      expect(data).to include('from' => '2026-11-05', 'to' => '2026-11-06', 'previous_from' => '2026-11-03',
                              'previous_to' => '2026-11-04')
      expect(data['previous_totals']).to include('orders' => 1, 'sales_total' => '15000.0', 'customers' => 1)
      expect(data['previous_by_day'].map { |row| [row['date'], row['orders']] }).to eq([['2026-11-03', 1], ['2026-11-04', 0]])

      single = overview(reader, from: '2026-11-06', to: '2026-11-06', compare: '1')
      expect(single).to include('previous_from' => '2026-11-05', 'previous_to' => '2026-11-05')
      expect(single['previous_totals']).to include('orders' => 2, 'sales_total' => '50000.0')
    ensure
      travel_back
    end

    it 'rejects the filters the sales report rejects' do
      overview(reader, from: '07/11/2026')
      expect(response).to have_http_status(:unprocessable_content)
      overview(reader, from: '2026-11-07', to: '2026-11-01')
      expect(response).to have_http_status(:unprocessable_content)
      overview(reader, foo: '1')
      expect(response).to have_http_status(:unprocessable_content)
    end

    it 'takes only a date range, so the previous period compares like with like' do
      [{ order_source: 'counter' }, { section: 'returns' }, { register_id: 'posreg_x' }, { shift_id: 'posshift_x' },
       { cashier_id: cashier.prefixed_id }].each do |filter|
        expect(fetch(reader, 'overview', **filter).dig('error', 'message')).to start_with('Unknown filter')
        expect(response).to have_http_status(:unprocessable_content)
      end
      %w[yes 2].each do |value|
        overview(reader, compare: value)
        expect(response).to have_http_status(:unprocessable_content)
      end
      %w[0 false].each do |value|
        expect(overview(reader, compare: value)['previous_totals']).to be_nil
      end
      expect(overview(reader, compare: 'true')['previous_totals']).to include('orders' => 0)
    end
  end

  describe 'scope' do
    it 'shows a cashier only their own orders and refuses non-members as the reports do' do
      paid_sale(store, branch, cashier: cashier, price: 40_000)
      paid_sale(store, branch, cashier: colleague, price: 60_000)

      own = overview(cashier)
      expect(response).to have_http_status(:ok)
      expect_pos_schema!(response, 'Overview')
      expect(own['scope']).to eq('own')
      expect(own['totals']).to include('orders' => 1, 'sales_total' => '40000.0')
      expect(own.dig('top_items', 'by_quantity').length).to eq(1)
      expect(own['status_counts']['all']).to eq(1)
      expect(overview(reader)['totals']).to include('orders' => 2, 'sales_total' => '100000.0')

      elsewhere = credit_branch(store)
      outsider = credit_staff(store, elsewhere, PosShiftHelpers::MANAGER + [Spree::Pos::Capabilities::REPORT_READ])
      fetch(outsider, 'reports/sales')
      expect(response).to have_http_status(:forbidden)
      overview(outsider)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
