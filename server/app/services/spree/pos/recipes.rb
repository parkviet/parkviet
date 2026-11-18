# frozen_string_literal: true

module Spree
  module Pos
    # Recipes of menu sizes and modifier options, consumed from the branch
    # shelf when a sale completes (module `fnb.recipes`). Quantities are kept
    # in each ingredient's stock unit, the unit Spree counts its shelf in.
    module Recipes
      MODULE = 'fnb.recipes'
      MAX_INGREDIENTS = 50

      module_function

      # Changing recipes and stock alerts takes pos.inventory.manage at an
      # active branch of the store, or store administration.
      def manage!(store, staff)
        access = AccessPolicy.new(store: store, staff: staff)
        return if access.permission?('write_pos_topology')

        allowed = access.memberships.any? { |membership| membership.status == 'active' && membership.allows?(Capabilities::INVENTORY_MANAGE) }
        raise CanCan::AccessDenied unless allowed
      end

      # Reading recipes and their costs: the people who change the menu or stock.
      def read!(store, staff)
        access = AccessPolicy.new(store: store, staff: staff)
        return if access.permission?('read_pos_topology') || access.permission?('write_pos_topology')

        allowed = access.memberships.any? do |membership|
          membership.status == 'active' &&
            [Capabilities::INVENTORY_MANAGE, Capabilities::MANAGE_MENU].any? { |capability| membership.allows?(capability) }
        end
        raise CanCan::AccessDenied unless allowed
      end

      # The ingredient's stock unit: the base unit of its unit configuration,
      # or `item` without one.
      def base_unit(store, variant)
        StockIntegration.variant_unit(store.id, variant)&.base_unit ||
          UnitDefinition.find_by!(store_id: store.id, code: UnitDefinition::FALLBACK_CODE)
      end

      # `quantity` (a Rational) of `unit_code` in the ingredient's stock unit,
      # as a whole number. The unit must measure what the stock unit measures;
      # the ingredient's own sale unit also applies its pack ratio (1 thùng = 24 chai).
      def base_quantity(store, variant, quantity, unit_code)
        UnitDefinition.ensure_defaults!(store)
        base = base_unit(store, variant)
        unit = UnitDefinition.for_store(store).active.find_by(code: unit_code.to_s.strip.downcase)
        raise Conflict.new('Unknown unit.', reason: 'recipe_unit_unknown', details: { unit: unit_code.to_s }) if unit.nil?
        unless unit.dimension == base.dimension && unit.base_code == base.code
          raise Conflict.new("#{unit.code} does not measure what #{base.code} measures.", reason: 'recipe_unit_dimension',
                                                                                          details: { unit: unit.code, base_unit: base.code })
        end

        configured = StockIntegration.variant_unit(store.id, variant)
        factor = Rational(unit.factor_to_base)
        factor *= Rational(configured.ratio_numerator, configured.ratio_denominator) if configured && configured.sale_unit_id == unit.id
        amount = quantity * factor
        unless amount.denominator == 1 && amount.positive?
          raise Conflict.new("The quantity is not a whole number of #{base.code}.", reason: 'recipe_quantity_inexact',
                                                                                    details: { unit: unit.code, base_unit: base.code })
        end

        [amount.numerator, base.code]
      end

      # A measured pour from a bottle counted by the bottle: a volume unit
      # (ml, l) for an ingredient whose stock unit is a count. Returns the
      # row's pour fields (`bottle_ml` is the size of one bottle), or nil for
      # any other row. Such a row moves no stock itself (Fnb::PourTracker).
      def pour_quantity(store, variant, quantity, unit_code, bottle_ml)
        UnitDefinition.ensure_defaults!(store)
        base = base_unit(store, variant)
        unit = UnitDefinition.for_store(store).active.find_by(code: unit_code.to_s.strip.downcase)
        return nil unless unit&.dimension == 'volume' && base.dimension == 'count'

        size = bottle_ml.to_s.match?(/\A\d{1,5}\z/) ? bottle_ml.to_i : 0
        unless size.between?(1, OpenBottle::MAX_ML)
          raise Conflict.new('Give the size of one bottle in ml.', reason: 'recipe_bottle_size_invalid', details: { unit: unit.code })
        end

        ml = quantity * Rational(unit.factor_to_base)
        unless ml.denominator == 1 && ml.positive? && ml <= size
          raise Conflict.new('A pour is a whole number of ml, at most one bottle.', reason: 'recipe_quantity_inexact',
                                                                                 details: { unit: unit.code, base_unit: 'ml' })
        end

        { base_quantity: 0, base_unit_code: base.code, pour_ml: ml.numerator, bottle_ml: size }
      end

      # The variant's cost per stock unit, from its `cost_price` (per price
      # unit, like its selling price), to four decimals; nil when it has none.
      # `configured` is the variant's active unit configuration when the
      # caller has read it already (nil for none).
      def unit_cost(store_id, variant, configured: StockIntegration.variant_unit(store_id, variant))
        return nil if variant.cost_price.nil?

        cost = variant.cost_price.to_r
        cost = cost * Rational(configured.ratio_denominator, configured.ratio_numerator) / configured.price_unit.factor_to_base if configured
        BigDecimal((cost * 10_000).round) / 10_000
      end

      # The owner of a recipe named by the request: a variant of the store (a
      # menu size or a combo part), or a modifier option of the store.
      def owner!(store, variant_id: nil, modifier_option_id: nil)
        if variant_id.present? == modifier_option_id.present?
          raise Conflict.new('Name either a variant or a modifier option.', reason: 'recipe_owner_invalid')
        end

        if variant_id.present?
          variant = Spree::Variant.find_by_prefix_id(variant_id.to_s)
          raise ActiveRecord::RecordNotFound if variant.nil? || variant.product&.store_id != store.id

          variant
        else
          ModifierOption.locate(ModifierOption.joins(:modifier_group).where(spree_pos_modifier_groups: { store_id: store.id }),
                                modifier_option_id) || raise(ActiveRecord::RecordNotFound)
        end
      end

      def owner_type(owner)
        owner.is_a?(Spree::Variant) ? 'variant' : 'modifier_option'
      end

      VARIANT_JOIN = 'LEFT JOIN spree_variants owner_variants ON spree_pos_recipes.owner_type = ' \
                     "'Spree::Variant' AND owner_variants.id = spree_pos_recipes.owner_id AND owner_variants.deleted_at IS NULL"
      PRODUCT_JOIN = 'LEFT JOIN spree_products owner_products ON owner_products.id = owner_variants.product_id ' \
                     'AND owner_products.deleted_at IS NULL'
      OPTION_JOIN = 'LEFT JOIN spree_pos_modifier_options owner_options ON spree_pos_recipes.owner_type = ' \
                    "'Spree::Pos::ModifierOption' AND owner_options.id = spree_pos_recipes.owner_id"
      GROUP_JOIN = 'LEFT JOIN spree_pos_modifier_groups owner_groups ON owner_groups.id = owner_options.modifier_group_id'
      LIST_SEARCH = 'owner_products.name ILIKE :like OR owner_variants.sku ILIKE :like OR ' \
                    'owner_options.name ILIKE :like OR owner_groups.name ILIKE :like'
      LIST_ORDER = 'COALESCE(owner_products.name, owner_groups.name) ASC, owner_options.name ASC NULLS FIRST, ' \
                   'spree_pos_recipes.id ASC'

      # The store's active recipes whose owner still exists, by product or
      # option name. `term` matches the product name, a SKU, the option or
      # its group; `owner_type` is `variant` or `modifier_option`;
      # `variant_ids` (database ids) keeps those variants' recipes.
      def listing(store, term: nil, owner_type: nil, variant_ids: nil)
        scope = Recipe.for_store(store).active.joins(VARIANT_JOIN, PRODUCT_JOIN, OPTION_JOIN, GROUP_JOIN)
        scope = scope.where('owner_products.id IS NOT NULL OR owner_groups.id IS NOT NULL')
        case owner_type.to_s
        when '' then nil
        when 'variant' then scope = scope.where(owner_type: 'Spree::Variant')
        when 'modifier_option' then scope = scope.where(owner_type: 'Spree::Pos::ModifierOption')
        else raise Conflict.new('Name variant or modifier_option.', reason: 'recipe_owner_invalid')
        end
        scope = scope.where(owner_type: 'Spree::Variant', owner_id: variant_ids) unless variant_ids.nil?
        text = term.to_s.strip
        scope = scope.where(LIST_SEARCH, like: "%#{ActiveRecord::Base.sanitize_sql_like(text)}%") if text.present?
        scope.order(Arel.sql(LIST_ORDER))
      end

      # A card of the recipe list for each record of `listing`: what it
      # makes, how many ingredients it has and what one costs today.
      def rows(store, records)
        ingredient_variants = { ingredient_variant: [:product, { option_values: :option_type }] }
        ActiveRecord::Associations::Preloader.new(records: records, associations: { recipe_ingredients: ingredient_variants }).call
        ingredient_ids = records.flat_map { |recipe| recipe.recipe_ingredients.map(&:ingredient_variant_id) }.uniq
        units = VariantUnit.includes(:price_unit).where(store_id: store.id, variant_id: ingredient_ids, status: 'active').index_by(&:variant_id)
        owned = ->(type) { records.select { |row| row.owner_type == type }.map(&:owner_id) }
        variants = Spree::Variant.with_deleted.includes(:product, option_values: :option_type).where(id: owned.call('Spree::Variant')).index_by(&:id)
        options = ModifierOption.includes(:modifier_group).where(id: owned.call('Spree::Pos::ModifierOption')).index_by(&:id)
        records.map do |recipe|
          costs = recipe.recipe_ingredients.map do |row|
            row.to_pos(unit_cost: unit_cost(store.id, row.ingredient_variant, configured: units[row.ingredient_variant_id]))[:cost]
          end
          row = { id: recipe.prefixed_id, version: recipe.version, ingredients: recipe.recipe_ingredients.size,
                  estimated_cost: costs.any?(&:nil?) ? nil : costs.sum { |value| BigDecimal(value) }.to_s('F') }
          if recipe.owner_type == 'Spree::Variant'
            variant = variants.fetch(recipe.owner_id)
            row.merge(owner_type: 'variant', owner_id: variant.prefixed_id, product_id: variant.product.prefixed_id,
                      name: variant.product.name, options_text: variant.options_text.presence, sku: variant.sku.presence,
                      group_name: nil, cost_price: variant.cost_price&.to_s('F'), track_inventory: variant.track_inventory)
          else
            option = options.fetch(recipe.owner_id)
            row.merge(owner_type: 'modifier_option', owner_id: option.prefixed_id, product_id: nil, name: option.name,
                      options_text: nil, sku: nil, group_name: option.modifier_group.name,
                      cost_price: option.cost_price&.to_s('F'), track_inventory: nil)
          end
        end
      end

      # The owner's active version and its history, newest first.
      def present(store, owner)
        versions = Recipe.for_owner(owner).includes(recipe_ingredients: { ingredient_variant: :product }).order(version: :desc).to_a
        active = versions.find(&:active)
        costs = active ? active.recipe_ingredients.to_h { |row| [row.ingredient_variant_id, unit_cost(store.id, row.ingredient_variant)] } : {}
        {
          owner_type: owner_type(owner), owner_id: owner.prefixed_id,
          track_inventory: owner.is_a?(Spree::Variant) ? owner.track_inventory : nil,
          active: active&.to_pos(costs: costs),
          versions: versions.map do |row|
            { id: row.prefixed_id, version: row.version, active: row.active, created_at: row.created_at.iso8601,
              ingredients: row.recipe_ingredients.size }
          end
        }
      end
    end
  end
end
