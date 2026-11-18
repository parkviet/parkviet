# frozen_string_literal: true

module Spree
  module Pos
    # The two VAT treatments the F&B setup step offers for new menu items,
    # under the codes its clients send, and the store's tax options they
    # stand for. The categories themselves are the catalog's deduction
    # options (TaxRegimes::Sync); the 8% food rate and the 10% rate that
    # replaces it on 2027-01-01 are a rate and its schedule, not code.
    module TaxCategories
      FOOD = 'vat_food'
      SPECIAL = 'vat_special'
      CODES = [FOOD, SPECIAL].freeze
      CATALOG_KEYS = TaxRegimes::Sync::LEGACY_CODES
      # What the F&B setup step proposes for new menu items, by role.
      MENU_DEFAULTS = { 'food' => FOOD, 'alcohol' => SPECIAL }.freeze

      module_function

      # The codes the F&B setup step offers, with the rate each has on `on`.
      # Catalog only, no query.
      def options(on: Date.current)
        CODES.map do |code|
          rate = VnTaxCatalog.deduction_rate(VnTaxCatalog.option(CATALOG_KEYS.fetch(code)), on: on)
          { code: code, rate: rate.to_s('F') }
        end
      end

      # Gives a store its tax regime and categories once; a store that has
      # a regime is left as it is.
      def seed!(store)
        TaxRegimes::Sync.adopt!(store)
      end

      # The store's live category for each setup code, by code.
      def categories_for(store, codes)
        keys = codes.to_h { |code| [CATALOG_KEYS.fetch(code), code] }
        Spree::TaxCategory.where(store_id: store.id, tax_code: keys.keys).to_h { |category| [keys[category.tax_code], category] }
      end
    end
  end
end
