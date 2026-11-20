# frozen_string_literal: true

module Spree
  module Pos
    # One product of a time-of-day menu: its price while the window runs (for
    # one size, or every size without a variant), or hidden.
    class MenuScheduleItem < Record
      self.table_name = 'spree_pos_menu_schedule_items'
      has_prefix_id :posmenuschitem

      belongs_to :menu_schedule, class_name: 'Spree::Pos::MenuSchedule', inverse_of: :menu_schedule_items
      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_menu_schedule_items
      belongs_to :variant, class_name: 'Spree::Variant', optional: true

      validates :price, numericality: { greater_than_or_equal_to: 0, less_than: 1_000_000_000 }, allow_nil: true
      validate :price_or_hidden
      validate :same_store

      def to_pos
        {
          id: prefixed_id, product_id: product.prefixed_id, variant_id: variant&.prefixed_id,
          price: price&.to_s('F'), hidden: hidden
        }
      end

      private

      def price_or_hidden
        errors.add(:price, :blank) if price.nil? && !hidden
      end

      def same_store
        return if menu_schedule.nil? || product.nil?

        errors.add(:product, :invalid) if product.store_id != menu_schedule.store_id
        errors.add(:variant, :invalid) if variant && variant.product_id != product_id
      end
    end
  end
end
