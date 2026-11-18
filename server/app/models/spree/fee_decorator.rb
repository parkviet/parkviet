# frozen_string_literal: true

module Spree
  # A POS service charge is an order-level fee of its own kind, taxed under
  # the tax category the branch chose. The tax engine reads `tax_category_id`
  # when an item has one; a fee stores it in its metadata. A service charge
  # or minimum-spend surcharge without one follows the store tax regime's
  # service fee default; any other fee is taxed under the store's default
  # category.
  module FeeDecorator
    # Decorators are loaded again on every code reload.
    SERVICE_CHARGE_KIND = 'service_charge' unless const_defined?(:SERVICE_CHARGE_KIND)
    # What a VIP table still owes below its minimum spend (Pos::Fnb::MinimumSpend).
    MINIMUM_SPEND_KIND = 'minimum_spend' unless const_defined?(:MINIMUM_SPEND_KIND)

    def self.prepended(base)
      [SERVICE_CHARGE_KIND, MINIMUM_SPEND_KIND].each { |kind| base::KINDS << kind unless base::KINDS.include?(kind) }
    end

    def tax_category_id
      value = metadata.is_a?(Hash) ? metadata['tax_category_id'] : nil
      return value.to_i if value.present?
      return nil unless [SERVICE_CHARGE_KIND, MINIMUM_SPEND_KIND].include?(kind) && order&.store_id

      Spree::Pos::TaxRegime.where(store_id: order.store_id).order(:id).last&.default_service_fee_tax_category_id
    end
  end

  Fee.prepend(FeeDecorator)
end
