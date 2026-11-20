# frozen_string_literal: true

module Spree
  module Pos
    # The quick-pick row of a branch's menu grid, in order: one product each.
    class MenuFavorite < Record
      self.table_name = 'spree_pos_menu_favorites'
      has_prefix_id :posmenufav

      MAX_PER_BRANCH = 20

      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_menu_favorites

      validates :product_id, uniqueness: { scope: :branch_id }
      validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
      validate :same_store

      # Product ids (database ids) of the branch's favourites, in order.
      def self.product_ids(branch)
        where(branch_id: branch.id).order(:position, :id).pluck(:product_id)
      end

      private

      def same_store
        errors.add(:product, :invalid) if branch && product && branch.store_id != product.store_id
      end
    end
  end
end
