# frozen_string_literal: true

module Spree
  module Pos
    # A store menu item placed in one electronic-menu category. Price, sizes
    # and options stay on the menu item; this row is only the placement.
    class EmenuItem < Record
      self.table_name = 'spree_pos_emenu_items'
      has_prefix_id :posemenuitem

      belongs_to :emenu_category, class_name: 'Spree::Pos::EmenuCategory', inverse_of: :emenu_items
      belongs_to :menu_item, class_name: 'Spree::Pos::MenuItem'

      validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
      validates :menu_item_id, uniqueness: { scope: :emenu_category_id }

      def to_pos
        { id: prefixed_id, menu_item_id: menu_item.prefixed_id, position: position }
      end
    end
  end
end
