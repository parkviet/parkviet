# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_return_helpers'

# A store's tax categories, rates and products follow its tax regime; a
# store that sold before the regime existed keeps selling exactly as before.
RSpec.describe Spree::Pos::TaxRegimes::Sync do
  include PosReturnHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:cashier) { credit_staff(store, branch, PosReturnHelpers::RETURNS, extra_permissions: %w[write_pos_topology]) }

  before do
    # Vietnamese VAT, matched on the market's country.
    Spree::Market.where(store_id: store.id).find_each { |market| market.update!(country_codes: ['VN']) }
  end

  def category(key)
    Spree::TaxCategory.find_by!(store_id: store.id, tax_code: key)
  end

  def save!(attributes, **options)
    Spree::Pos::TaxRegimes::Save.call(store: store, actor: cashier, attributes: attributes, **options)
  end

  def tax_lines(sale)
    Spree::TaxLine.where(order_id: sale.workspace.order_id).order(:id).map { |line| [line.label, line.rate, line.amount, line.included] }
  end

  # What TaxCategories.seed! wrote before the catalog: two categories with
  # an 8% rate scheduled to 10% and a 10% rate, prices including tax.
  def legacy_seed!
    food = Spree::TaxCategory.create!(store: store, name: 'VAT thực phẩm', tax_code: 'vat_food', is_default: false)
    special = Spree::TaxCategory.create!(store: store, name: 'VAT đặc biệt', tax_code: 'vat_special', is_default: false)
    rate = Spree::TaxRate.create!(store: store, tax_category: food, name: 'VAT thực phẩm', amount: BigDecimal('0.08'),
                                  included_in_price: true, show_rate_in_label: false, country_code: 'VN')
    Spree::TaxRate.create!(store: store, tax_category: special, name: 'VAT đặc biệt', amount: BigDecimal('0.10'),
                           included_in_price: true, show_rate_in_label: false, country_code: 'VN')
    Spree::Pos::TaxRateSchedule.create!(store: store, tax_rate: rate, effective_on: Date.new(2027, 1, 1), amount: BigDecimal('0.10'))
    [food, special, rate]
  end

  it 'taxes a product without a category of its own under the store default category' do
    described_class.adopt!(store)
    product = stocked_product(store, branch, price: 100_000)
    product.update_column(:tax_category_id, nil)
    category('deduction.vat_10').update!(is_default: true)

    sale = paid_sale(store, branch, cashier: cashier, price: 100_000, product: Spree::Product.find(product.id))
    line = sale.workspace.order.line_items.sole
    expect(line.tax_category).to eq(category('deduction.vat_10'))
    expect(Spree::TaxLine.where(line_item_id: line.id).pluck(:rate, :amount)).to eq([[BigDecimal('0.1'), BigDecimal('10000')]])
  end

  it 'adopts a store that sold before the regime without changing a single tax line' do
    food, special, rate = legacy_seed!
    product = stocked_product(store, branch, price: 108_000)
    product.update!(tax_category: food)
    plain = stocked_product(store, branch, price: 50_000)
    before = paid_sale(store, branch, cashier: cashier, price: 108_000, product: product)
    untaxed_before = paid_sale(store, branch, cashier: cashier, price: 50_000, product: plain)

    regime = described_class.adopt!(store)

    expect(regime).to have_attributes(tax_method: 'deduction', revenue_group: 'group_3', enabled: true,
                                      prices_include_tax: store.default_market.tax_inclusive)
    expect(food.reload.tax_code).to eq('deduction.vat_8')
    expect(special.reload.tax_code).to eq('deduction.vat_10')
    expect(rate.reload).to have_attributes(name: 'VAT thực phẩm', amount: BigDecimal('0.08'), deleted_at: nil)
    expect(Spree::Pos::TaxRateSchedule.where(tax_rate: rate).pluck(:effective_on)).to eq([Date.new(2027, 1, 1)])
    expect(Spree::TaxRate.where(store_id: store.id, tax_category_id: food.id).count).to eq(1)
    expect(regime.item_option).to eq(Spree::TaxCategory.default(store).tax_code)

    after = paid_sale(store, branch, cashier: cashier, price: 108_000, product: product)
    untaxed_after = paid_sale(store, branch, cashier: cashier, price: 50_000, product: plain)
    expect(tax_lines(after)).to eq(tax_lines(before))
    expect(after.workspace.order.reload.total).to eq(before.workspace.order.reload.total)
    expect(tax_lines(untaxed_after)).to eq(tax_lines(untaxed_before))
    expect(Spree::Pos::LineTaxSnapshot.where(store_id: store.id)).to be_empty

    expect(described_class.adopt!(store)).to eq(regime)
    expect(Spree::Pos::TaxRegime.for_store(store).count).to eq(1)
  end

  it 'counts this year’s revenue once when it adopts a store that already sold' do
    paid_sale(store, branch, cashier: cashier, price: 70_000)
    Spree::Pos::TaxRevenueYear.delete_all

    described_class.adopt!(store)
    year = Spree::Pos::TaxRevenueYear.find_by!(store_id: store.id, year: Spree::Pos::DirectTax.today.year)
    expect(year.revenue).to eq(70_000)
    expect(year.crossed_on).to be_nil
  end

  it 'gives every deduction rate option one Vietnam rate and the reduced rate its schedule' do
    described_class.adopt!(store)
    rates = Spree::Pos::VnTaxCatalog.options('deduction').to_h do |option|
      [option[:code], Spree::TaxRate.where(store_id: store.id, tax_category: category(option[:code])).pluck(:amount, :country_code)]
    end
    expect(rates).to eq(
      'deduction.exempt' => [], 'deduction.not_taxed' => [], 'deduction.vat_0' => [[BigDecimal('0'), 'VN']],
      'deduction.vat_5' => [[BigDecimal('0.05'), 'VN']], 'deduction.vat_8' => [[BigDecimal('0.08'), 'VN']],
      'deduction.vat_10' => [[BigDecimal('0.1'), 'VN']]
    )
    reduced = Spree::TaxRate.find_by!(store_id: store.id, tax_category: category('deduction.vat_8'))
    expect(Spree::Pos::TaxRateSchedule.where(tax_rate: reduced).pluck(:effective_on, :amount)).to eq([[Date.new(2027, 1, 1), BigDecimal('0.1')]])
  end

  it 'moves every product to the new default and retires the old categories when the method changes' do
    described_class.adopt!(store)
    on_ten = stocked_product(store, branch, price: 10_000)
    on_ten.update!(tax_category: category('deduction.vat_10'))
    following = stocked_product(store, branch, price: 10_000)
    branch.update!(service_charge_tax_category: category('deduction.vat_10'))
    old_ids = Spree::TaxCategory.where(store_id: store.id).where('tax_code LIKE ?', 'deduction.%').pluck(:id)

    save!({ method: 'direct', revenue_group: 'group_1', item_option: 'direct.goods' })

    goods = category('direct.goods')
    expect([on_ten.reload.tax_category_id, following.reload.tax_category_id]).to eq([goods.id, goods.id])
    expect(goods.is_default).to be(true)
    expect(Spree::TaxCategory.where(id: old_ids)).to be_empty
    expect(Spree::TaxCategory.with_deleted.where(id: old_ids).count).to eq(old_ids.size)
    expect(Spree::TaxRate.where(store_id: store.id)).to be_empty
    expect(branch.reload.service_charge_tax_category_id).to be_nil
    audit = Spree::Pos::AuditEntry.where(store_id: store.id, action: 'tax_regime.change').sole
    expect(audit.metadata).to include('reassigned_products' => 2)

    # Back to deduction: the retired categories return with the same ids.
    save!({ method: 'deduction', revenue_group: 'group_3', item_option: 'deduction.vat_10' })
    expect(category('deduction.vat_10').id).to be_in(old_ids)
    expect(on_ten.reload.tax_category_id).to eq(category('deduction.vat_10').id)
    expect(Spree::TaxRate.where(store_id: store.id, tax_category: category('deduction.vat_10')).count).to eq(1)
  end

  it 'moves only the products on the old default when the default changes, or all of them when asked' do
    described_class.adopt!(store)
    save!({ item_option: 'deduction.vat_8' })
    following = stocked_product(store, branch, price: 10_000)
    following.update!(tax_category: category('deduction.vat_8'))
    chosen = stocked_product(store, branch, price: 10_000)
    chosen.update!(tax_category: category('deduction.vat_5'))

    save!({ item_option: 'deduction.vat_10' })
    expect(following.reload.tax_category).to eq(category('deduction.vat_10'))
    expect(chosen.reload.tax_category).to eq(category('deduction.vat_5'))
    expect(Spree::Pos::AuditEntry.where(store_id: store.id, action: 'tax_regime.change').order(:id).last.metadata).
      to include('reassigned_products' => 1, 'apply_to_all_products' => false)

    save!({}, apply_to_all_products: true)
    expect(chosen.reload.tax_category).to eq(category('deduction.vat_10'))
  end

  it 'drops the rates while the regime is off and gives them back when it is on' do
    described_class.adopt!(store)
    save!({ enabled: false })
    expect(Spree::TaxRate.where(store_id: store.id)).to be_empty

    save!({ enabled: true })
    expect(Spree::TaxRate.where(store_id: store.id, tax_category: category('deduction.vat_10')).pluck(:amount)).to eq([BigDecimal('0.1')])
  end

  it 'makes the market say whether prices include tax under the deduction method' do
    described_class.adopt!(store)
    save!({ prices_include_tax: false })
    expect(Spree::Market.where(store_id: store.id).pluck(:tax_inclusive).uniq).to eq([false])
    save!({ prices_include_tax: true })
    expect(Spree::Market.where(store_id: store.id).pluck(:tax_inclusive).uniq).to eq([true])
  end
end
