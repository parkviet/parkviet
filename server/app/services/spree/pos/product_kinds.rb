# frozen_string_literal: true

module Spree
  module Pos
    # The POS kinds of product, read from the product's Spree product type.
    # Spree 6 product types carry no metadata, so a kind is recognised by the
    # fixed name the dashboard creates its type with, compared without case,
    # spacing or Vietnamese marks: "Sản phẩm chế biến" and "san pham che bien"
    # are the same kind, any other name is no kind. The same rule as
    # `productKindOf` in `apps/pos/src/hooks/use-goods-setup.ts`;
    # change both together.
    module ProductKinds
      NAMES = {
        'goods' => 'Sản phẩm thường',
        'prepared' => 'Sản phẩm chế biến',
        'service' => 'Dịch vụ',
        'ingredient' => 'Nguyên liệu'
      }.freeze
      # Names used before the kinds were renamed still count as plain products.
      LEGACY_GOODS_NAMES = ['Hàng hoá', 'Sản phẩm'].freeze
      KINDS = NAMES.keys.freeze

      module_function

      def fold(name)
        name.to_s.unicode_normalize(:nfd).gsub(/\p{M}/, '').tr('đĐ', 'dd').downcase.gsub(/\s+/, ' ').strip
      end

      def kind_of(name)
        by_name[fold(name)]
      end

      # Ids of the product types of a kind, in one store or in every store.
      def type_ids(kind, store: nil)
        raise ArgumentError, "Unknown product kind: #{kind}" unless KINDS.include?(kind.to_s)

        types = Spree::ProductType.all
        types = types.where(store_id: store.id) if store
        types.to_a.select { |type| kind_of(type.name) == kind.to_s }.map(&:id)
      end

      def kind_for(product)
        product&.product_type && kind_of(product.product_type.name)
      end

      def by_name
        @by_name ||= LEGACY_GOODS_NAMES.to_h { |name| [fold(name), 'goods'] }.
                     merge(NAMES.to_h { |kind, name| [fold(name), kind] }).freeze
      end
    end
  end
end
