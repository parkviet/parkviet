# frozen_string_literal: true

module Spree
  module Pos
    # Sold-out state of a product at a branch. It holds for the business
    # date it was set on only, so a new business day starts with the product
    # back on sale.
    class MenuAvailability < Record
      self.table_name = 'spree_pos_menu_availabilities'
      has_prefix_id :posmenuavail

      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :product, class_name: 'Spree::Product', inverse_of: :pos_menu_availabilities
      belongs_to :updated_by, polymorphic: true, optional: true

      validates :product_id, uniqueness: { scope: :branch_id }
      validate :same_store

      # Product ids (database ids) sold out at the branch on a business date.
      def self.sold_out_ids(branch, business_date)
        where(branch_id: branch.id, sold_out_on: business_date).pluck(:product_id)
      end

      def self.sold_out?(branch, product, business_date)
        exists?(branch_id: branch.id, product_id: product.id, sold_out_on: business_date)
      end

      private

      def same_store
        errors.add(:product, :invalid) if branch && product && branch.store_id != product.store_id
      end
    end
  end
end
