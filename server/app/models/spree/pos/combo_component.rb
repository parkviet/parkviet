# frozen_string_literal: true

module Spree
  module Pos
    # What one combo contains: a variant and how many of it per combo. The
    # combo is the product (`product_id`); a product with any row is a combo.
    class ComboComponent < Record
      self.table_name = 'spree_pos_combo_components'
      has_prefix_id :poscombocomp

      MAX_QUANTITY = 100

      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_combo_components
      belongs_to :variant, class_name: 'Spree::Variant'

      validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: MAX_QUANTITY }
      validates :variant_id, uniqueness: { scope: :product_id }
      validate :variant_belongs_to_store

      def self.label(variant)
        options = variant.respond_to?(:options_text) ? variant.options_text.to_s : ''
        [variant.product.name, options.presence].compact.join(' - ').first(200)
      end

      def to_pos
        { id: prefixed_id, variant_id: variant.prefixed_id, name: self.class.label(variant), quantity: quantity }
      end

      private

      def variant_belongs_to_store
        return if variant.nil? || product.nil?

        errors.add(:variant, :invalid) if variant.product&.store_id != product.store_id
      end
    end
  end
end
