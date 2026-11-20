# frozen_string_literal: true

module Spree
  module Pos
    # A store product placed in one electronic-menu category. Price, sizes
    # and options stay on the product; this row is only the placement.
    class EmenuItem < Record
      self.table_name = 'spree_pos_emenu_items'
      has_prefix_id :posemenuitem

      belongs_to :emenu_category, class_name: 'Spree::Pos::EmenuCategory', inverse_of: :emenu_items
      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_emenu_items

      validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
      validates :product_id, uniqueness: { scope: :emenu_category_id }
      validate :same_store

      def to_pos
        { id: prefixed_id, product_id: product.prefixed_id, position: position }
      end

      private

      def same_store
        branch = emenu_category&.branch
        errors.add(:product, :invalid) if branch && product && branch.store_id != product.store_id
      end
    end
  end
end
