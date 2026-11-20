# frozen_string_literal: true

module Spree
  module Pos
    # A modifier group offered on a product, in display order.
    class ProductModifierGroup < Record
      self.table_name = 'spree_pos_product_modifier_groups'
      has_prefix_id :posprodmodgroup

      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_product_modifier_groups
      belongs_to :modifier_group, class_name: 'Spree::Pos::ModifierGroup'

      validates :modifier_group_id, uniqueness: { scope: :product_id }
      validate :same_store

      private

      def same_store
        return if product.nil? || modifier_group.nil?

        errors.add(:modifier_group, :invalid) if product.store_id != modifier_group.store_id
      end
    end
  end
end
