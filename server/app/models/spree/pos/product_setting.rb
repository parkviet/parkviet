# frozen_string_literal: true

module Spree
  module Pos
    # How the POS handles one Spree product: the kitchen category it routes
    # by, whether each unit gets a cup label, whether the kitchen screen lists
    # a combo's contents, whether guests may order it from the table QR, and
    # the drink credit a door ticket carries. A product without a row uses
    # the column defaults. Product data itself stays on the Spree product.
    class ProductSetting < Record
      self.table_name = 'spree_pos_product_settings'
      has_prefix_id :posprodset

      KITCHEN_CATEGORY = /\A[a-z_]{2,40}\z/
      MAX_DRINK_CREDIT_CATEGORIES = 20

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_setting

      validates :kitchen_category, format: { with: KITCHEN_CATEGORY }, allow_nil: true
      validates :drink_credit, numericality: { greater_than: 0 }, allow_nil: true
      validate :drink_credit_categories_valid
      validates :product_id, uniqueness: { scope: :store_id }
      validate :product_belongs_to_store

      scope :for_store, ->(store) { where(store_id: store.id) }

      # The setting of a product, built with the defaults when it has none.
      def self.for_product(product)
        product.pos_setting || new(store_id: product.store_id, product: product)
      end

      # A door ticket: each one sold lets the guest drink this much of the
      # allowed kitchen categories (every category when none are named).
      def door_ticket?
        drink_credit.present?
      end

      private

      def drink_credit_categories_valid
        values = drink_credit_categories
        return if values.is_a?(Array) && values.size <= MAX_DRINK_CREDIT_CATEGORIES &&
          values.all? { |value| value.is_a?(String) && value.match?(KITCHEN_CATEGORY) }

        errors.add(:drink_credit_categories, :invalid)
      end

      def product_belongs_to_store
        errors.add(:product, :invalid) if product && product.store_id != store_id
      end
    end
  end
end
