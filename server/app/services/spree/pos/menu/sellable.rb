# frozen_string_literal: true

module Spree
  module Pos
    module Menu
      # The one rule for what a branch sells at the till: products of the
      # store that are active and within their availability window on the
      # store's `pos` sales channel (SalesChannel.sellable_products), in the
      # branch's assortment (`spree_pos_branch_products`, which is always
      # explicit: a product the branch was not given is not sold there), and
      # not of the "Nguyên liệu" type, since ingredients are used up by
      # recipes, never sold. Raises the SalesChannel conflicts when the
      # store's `pos` channel is missing or switched off.
      module Sellable
        module_function

        def products(branch)
          scope = SalesChannel.sellable_products(branch.store).
                  where(id: BranchProduct.where(branch_id: branch.id).select(:product_id))
          ingredient_types = ProductKinds.type_ids('ingredient', store: branch.store)
          return scope if ingredient_types.empty?

          scope.where('spree_products.product_type_id IS NULL OR spree_products.product_type_id NOT IN (?)', ingredient_types)
        end

        # The products of `products(branch)` of the "Sản phẩm chế biến" type.
        def prepared(branch)
          products(branch).where(product_type_id: ProductKinds.type_ids('prepared', store: branch.store))
        end

        def product?(branch, product)
          !product.nil? && products(branch).exists?(id: product.id)
        end
      end
    end
  end
end
