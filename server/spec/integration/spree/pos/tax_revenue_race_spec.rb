# frozen_string_literal: true

require_relative '../../../support/pos_return_helpers'
require_relative '../../../support/pos_race_helpers'

# Two counters completing sales at once add to the year's revenue one after
# the other, so the threshold is crossed once and income tax is owed on
# exactly the revenue above it.
RSpec.describe 'POS tax revenue races', type: :integration do
  include PosReturnHelpers

  include_context 'with committed POS race rows'

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:threshold) { BigDecimal('1000000000') }

  it 'crosses the threshold once when two sales complete together' do
    branch = returns_branch(store)
    staff = 2.times.map { credit_staff(store, branch, PosReturnHelpers::RETURNS, extra_permissions: %w[write_pos_topology]) }
    Spree::Pos::TaxCategories.seed!(store)
    Spree::Pos::TaxRegimes::Save.call(store: store, actor: staff.first,
                                      attributes: { method: 'direct', revenue_group: 'group_1', item_option: 'direct.service' })
    sales = staff.map do |cashier|
      product = stocked_product(store, branch, price: 100_000)
      product.update!(tax_category: Spree::TaxCategory.default(store))
      sale = open_sale(store, branch, cashier: cashier, product: product)
      take_tender(sale, 'cash', 100_000)
      sale
    end
    year = Spree::Pos::TaxRevenueYear.lock_for!(store, sales.first.workspace.business_date.year)
    year.update!(revenue: threshold - 50_000)

    results = race(year) { |index| Spree::Pos::Workspaces::Complete.call(**editing_args(sales[index])) }

    expect(results.map(&:first)).to eq(%i[success success])
    year.reload
    expect(year.revenue).to eq(threshold + 150_000)
    rows = Spree::Pos::LineTaxSnapshot.where(store_id: store.id).order(:id)
    expect(rows.map(&:pit_base_amount)).to eq([50_000, 100_000])
    expect(rows.sum(&:pit_amount)).to eq(3_000)
    expect(year.crossed_on).to eq(sales.first.workspace.business_date)
    expect(year.crossed_period).to be_present
  end
end
