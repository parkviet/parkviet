# frozen_string_literal: true

# Gives every store its first tax regime from the categories it already has,
# so it sells exactly as before: the deduction method with the default
# market's choice of prices including tax, vat_food and vat_special become
# the 8% and 10% deduction options (same ids, rates and schedules), the
# store's default category the option its rate matches, and this year's
# revenue is counted once from the completed sales and received returns.
class AdoptPosTaxRegimes < ActiveRecord::Migration[8.1]
  def up
    [Spree::Pos::TaxRegime, Spree::Pos::TaxRevenueYear, Spree::Pos::LineTaxSnapshot].each(&:reset_column_information)
    Spree::Store.find_each { |store| Spree::Pos::TaxRegimes::Sync.adopt!(store) }
  end

  # Gives the two legacy categories their codes back and forgets the
  # regimes; categories created for other options stay.
  def down
    Spree::Pos::TaxRegimes::Sync::LEGACY_CODES.each do |code, key|
      Spree::TaxCategory.with_deleted.where(tax_code: key).update_all(tax_code: code)
    end
    execute('DELETE FROM spree_pos_line_tax_snapshots')
    execute('DELETE FROM spree_pos_tax_revenue_years')
    execute('DELETE FROM spree_pos_tax_regimes')
  end
end
