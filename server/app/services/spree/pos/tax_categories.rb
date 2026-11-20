# frozen_string_literal: true

module Spree
  module Pos
    # The store-regime seed used by stores and demo data. Legacy VAT codes
    # stay in TaxRegimes::Sync so pre-catalog categories are retagged.
    module TaxCategories
      module_function

      # Gives a store its tax regime and categories once; a store that has
      # a regime is left as it is.
      def seed!(store)
        TaxRegimes::Sync.adopt!(store)
      end

    end
  end
end
