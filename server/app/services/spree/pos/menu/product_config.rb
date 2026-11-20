# frozen_string_literal: true

module Spree
  module Pos
    module Menu
      # The POS operating data of one product as the till and the settings
      # screens read it: its kind, operating settings (defaults without a
      # row), add-on groups and combo contents. Only a prepared product
      # ("Sản phẩm chế biến") is sold as a menu line, so any other product
      # reads with the defaults, no add-ons and no contents, the way it sells.
      module ProductConfig
        PRELOAD = [:tax_category, :product_type, :pos_setting, { pos_product_modifier_groups: :modifier_group },
                   { pos_combo_components: { variant: :product } }].freeze

        module_function

        def to_pos(product)
          menu = product.pos_prepared?
          setting = menu ? ProductSetting.for_product(product) : ProductSetting.new(store_id: product.store_id, product: product)
          components = menu ? product.pos_combo_components.to_a : []
          {
            product_id: product.prefixed_id, name: product.name, product_kind: product.pos_kind,
            kind: components.any? ? 'combo' : 'single', tax_category_id: product.tax_category.try(:prefixed_id),
            modifier_group_ids: menu ? product.pos_product_modifier_groups.map { |row| row.modifier_group.prefixed_id } : [],
            components: components.map(&:to_pos)
          }.merge(setting.to_pos)
        end
      end
    end
  end
end
