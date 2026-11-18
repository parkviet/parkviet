# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../support/pos_return_helpers'

# A direct-method store: the customer pays the listed price, nothing is
# printed, and each sale records the VAT and income tax it owes; the year's
# revenue decides whether any of it is due.
RSpec.describe Spree::Pos::DirectTax do
  include PosReturnHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:cashier) { credit_staff(store, branch, PosReturnHelpers::RETURNS, extra_permissions: %w[write_pos_topology]) }
  let(:threshold) { BigDecimal('1000000000') }

  before do
    Spree::Market.where(store_id: store.id).find_each { |market| market.update!(country_codes: ['VN']) }
    Spree::Pos::TaxCategories.seed!(store)
  end

  def go_direct!(**attributes)
    Spree::Pos::TaxRegimes::Save.call(
      store: store, actor: cashier,
      attributes: { method: 'direct', revenue_group: 'group_1', item_option: 'direct.service' }.merge(attributes)
    )
    Spree::Pos::TaxRegime.current(store)
  end

  # The product factory picks a category of its own; a store's new
  # product starts on the store default.
  def product(price)
    stocked_product(store, branch, price: price).tap { |row| row.update!(tax_category: Spree::TaxCategory.default(store)) }
  end

  def sell(price)
    paid_sale(store, branch, cashier: cashier, price: price, product: product(price))
  end

  def year_row(day = Spree::Pos::DirectTax.today)
    Spree::Pos::TaxRevenueYear.lock_for!(store, day.year)
  end

  def snapshots(sale)
    Spree::Pos::LineTaxSnapshot.where(order_id: sale.workspace.order_id).order(:id)
  end

  def summary
    Spree::Pos::DirectTax.year_summary(store)
  end

  it 'charges the listed price, writes no tax lines and records VAT on what was paid' do
    regime = go_direct!
    sale = sell(100_000)
    order = sale.workspace.order.reload

    expect(order.total).to eq(100_000)
    expect(Spree::TaxLine.where(order_id: order.id)).to be_empty
    row = snapshots(sale).sole
    expect(row).to have_attributes(kind: 'item', rate_key: 'direct.service', tax_category_id: order.line_items.sole.tax_category_id,
                                   vat_rate: BigDecimal('0.05'), pit_rate: BigDecimal('0.02'), revenue_amount: 100_000,
                                   vat_amount: 5_000, pit_base_amount: 0, pit_amount: 0, regime_id: regime.id,
                                   business_date: sale.workspace.business_date)
    expect(summary).to include(revenue: '100000.0', tax_due: false, vat_amount: '5000.0', payable_amount: '0.0', crossed_on: nil)
  end

  it 'records the VAT of a discounted sale on what the customer paid' do
    go_direct!
    sale = open_sale(store, branch, cashier: cashier, product: product(100_000))
    Spree::Pos::Workspaces::ApplyDiscount.call(**editing_args(sale), value_type: 'flat', value: '20000', reason: 'Khách quen')
    complete_paid(sale)

    expect(sale.workspace.order.reload.total).to eq(80_000)
    expect(snapshots(sale).sole).to have_attributes(revenue_amount: 80_000, vat_amount: 4_000)
  end

  it 'taxes income only on the revenue above the threshold, and the whole year’s VAT once it is crossed' do
    go_direct!
    first = sell(100_000)
    year_row.update!(revenue: threshold - 50_000)
    second = sell(100_000)

    expect(snapshots(first).sole).to have_attributes(pit_base_amount: 0, pit_amount: 0, vat_amount: 5_000)
    expect(snapshots(second).sole).to have_attributes(pit_base_amount: 50_000, pit_amount: 1_000, vat_amount: 5_000)
    expect(summary).to include(tax_due: true, vat_amount: '10000.0', pit_amount: '1000.0', payable_amount: '11000.0',
                               crossed_on: second.workspace.business_date.iso8601, warning: 'crossed')
  end

  it 'leaves income tax to the period report when it is computed on income' do
    go_direct!(revenue_group: 'group_3')
    year_row.update!(revenue: threshold)
    sale = sell(100_000)
    expect(snapshots(sale).sole).to have_attributes(pit_rate: nil, pit_base_amount: 100_000, pit_amount: 0, vat_amount: 5_000)
  end

  it 'takes a return back out with its tax negated and can bring the year back under the threshold' do
    go_direct!
    year_row.update!(revenue: threshold - 50_000)
    sale = sell(100_000)
    expect(year_row.crossed_on).to be_present

    result = return_and_receive(store, cashier, branch, sale, quantity: 1)
    reversed = Spree::Pos::LineTaxSnapshot.find_by!(return_operation_id: operation(result).id)
    expect(reversed).to have_attributes(kind: 'item', rate_key: 'direct.service', revenue_amount: -100_000, vat_amount: -5_000,
                                        pit_base_amount: -50_000, pit_amount: -1_000)
    year = year_row
    expect(year.revenue).to eq(threshold - 50_000)
    expect([year.crossed_on, year.crossed_period]).to eq([nil, nil])
    expect(summary).to include(tax_due: false, payable_amount: '0.0', vat_amount: '0.0')
  end

  it 'counts the revenue of a deduction-method sale without recording line tax' do
    sale = sell(100_000)
    expect(snapshots(sale)).to be_empty
    expect(year_row.revenue).to eq(sale.workspace.order.reload.total - sale.workspace.order.additional_tax_total)
  end

  describe '.estimate' do
    it 'applies a resolution’s reduction on business dates inside it when the store asks' do
      regime = go_direct!(apply_reduction: true)
      lines = [{ rate_key: 'direct.service', revenue_amount: 100_000 }, { rate_key: 'direct.goods_vat_exempt', revenue_amount: 50_000 }]

      inside = described_class.estimate(store, lines, ytd: threshold - 120_000, regime: regime, on: Date.new(2026, 12, 31))
      expect(inside.map { |line| line.values_at(:vat_rate, :vat_amount, :pit_base_amount, :pit_amount) }).to eq(
        [[BigDecimal('0.04'), 4_000, 0, 0], [nil, 0, 30_000, 150]]
      )
      after = described_class.estimate(store, lines, ytd: 0, regime: regime, on: Date.new(2027, 1, 1))
      expect(after.first[:vat_amount]).to eq(5_000)
    end
  end

  describe Spree::Pos::TaxRevenueYear do
    it 'marks the crossing by declaration period and the e-invoice deadline 30 days after it ends' do
      year = described_class.lock_for!(store, 2026)
      year.add!(threshold, on: Date.new(2026, 7, 10), period: 'month')
      expect(year.crossed_on).to be_nil

      year.add!(1, on: Date.new(2026, 7, 14), period: 'month')
      expect([year.crossed_on, year.crossed_period, year.einvoice_deadline]).to eq([Date.new(2026, 7, 14), '2026-07', Date.new(2026, 8, 30)])
      year.add!(10, on: Date.new(2026, 8, 2), period: 'month')
      expect(year.crossed_on).to eq(Date.new(2026, 7, 14))

      year.add!(-11, on: Date.new(2026, 8, 3), period: 'quarter')
      year.add!(5, on: Date.new(2026, 8, 20), period: 'quarter')
      expect([year.crossed_on, year.crossed_period, year.einvoice_deadline]).to eq([Date.new(2026, 8, 20), '2026-Q3', Date.new(2026, 10, 30)])
    end

    it 'records the crossing on the period the tax profile declares' do
      Spree::Pos::TaxProfile.create!(store: store, declaration_period: 'month')
      go_direct!
      year_row.update!(revenue: threshold)
      sale = sell(10_000)
      day = sale.workspace.business_date
      expect(year_row.crossed_period).to eq(format('%<year>04d-%<month>02d', year: day.year, month: day.month))
    end
  end
end
