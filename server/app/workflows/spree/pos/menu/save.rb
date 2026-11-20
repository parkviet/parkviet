# frozen_string_literal: true

module Spree
  module Pos
    module Menu
      # Every change to the store's menu operations: one idempotent command
      # each, guarded by Guard, refused while no branch of the store runs
      # `fnb.menu`, and audited as `<resource>.change` with the operation.
      #
      # Products themselves (name, sizes, prices, categories, tax) are written
      # through the Admin API; here only their POS operating data is: the
      # operating settings, add-on groups and combo contents of a prepared
      # product ("Sản phẩm chế biến"), the only kind sold as a menu line.
      module Save
        SETTING_FIELDS = %w[kitchen_category cup_label show_components_on_kds qr_orderable drink_credit].freeze
        GROUP_FIELDS = %w[name min_select max_select allow_quantity position].freeze
        OPTION_FIELDS = %w[name price_delta cost_price default_selected position active].freeze
        SCHEDULE_FIELDS = %w[name days_of_week starts_at ends_at active label].freeze
        MAX_ROWS = 100

        module_function

        # The product's operating settings: kitchen category, cup label,
        # whether the kitchen screen lists a combo's contents, table-QR
        # ordering and a door ticket's drink credit. Fields left out keep
        # their value; a product without settings starts from the defaults.
        def product_settings(store:, staff:, key:, product:, attributes:)
          product_command(store, staff, key, 'product_setting', product, attributes) do
            record = product.pos_setting || ProductSetting.new(store: store, product: product)
            record.lock! if record.persisted?
            record.assign_attributes(attributes.slice(*SETTING_FIELDS))
            record.kitchen_category = record.kitchen_category.presence
            record.drink_credit = record.drink_credit.presence
            # The kitchen categories a door ticket's drink credit pays for.
            if attributes.key?('drink_credit_categories')
              record.drink_credit_categories = Array(attributes['drink_credit_categories']).map { |value| value.to_s.strip }.compact_blank.uniq
            end
            record.save!
          end
        end

        # The combo contents of a product, replaced as a whole: a product with
        # contents is a combo, an empty list makes it a single product again.
        def product_combo(store:, staff:, key:, product:, components:)
          rows = rows!(components)
          product_command(store, staff, key, 'product_combo', product, { 'components' => rows }) do
            replace_components!(store, product, rows)
          end
        end

        # The add-on groups offered on a product, replaced as a whole, in order.
        def product_modifier_groups(store:, staff:, key:, product:, modifier_group_ids:)
          ids = Array(modifier_group_ids).map(&:to_s)
          product_command(store, staff, key, 'product_modifier_groups', product, { 'modifier_group_ids' => ids }) do
            replace_groups!(store, product, ids)
          end
        end

        def modifier_group(store:, staff:, key:, attributes:, group: nil)
          # The writer manages the menu, so the answer carries the option costs.
          command(store, staff, key, 'modifier_group', group, attributes, present: ->(saved) { saved.to_pos(costs: true) }) do
            record = group || ModifierGroup.new(store: store)
            record.lock! if record.persisted?
            record.assign_attributes(attributes.slice(*GROUP_FIELDS))
            record.save!
            replace_options!(store, record, attributes['options']) if attributes.key?('options')
            record.reload
          end
        end

        def schedule(store:, staff:, key:, attributes:, schedule: nil)
          command(store, staff, key, 'menu_schedule', schedule, attributes) do
            record = schedule || MenuSchedule.new(store: store)
            record.lock! if record.persisted?
            record.assign_attributes(attributes.slice(*SCHEDULE_FIELDS))
            record.branch = attributes['branch_id'].present? ? Guard.branch!(store, attributes['branch_id']) : nil if attributes.key?('branch_id')
            record.save!
            replace_schedule_items!(store, record, attributes['items']) if attributes.key?('items')
            record.reload
          end
        end

        def destroy(store:, staff:, key:, record:)
          resource = record.class.name.demodulize.underscore
          payload = { 'command' => "#{resource}.destroy", 'id' => record.prefixed_id }
          CommandExecutor.call(store: store, actor: staff, key: key, payload: payload, authorize: -> { Guard.manage!(store, staff) }) do
            ModulePolicy.require_store!(store, Guard::MODULE)
            record.destroy!
            AuditEntry.record!(store: store, actor: staff, action: "#{resource}.change", subject: record,
                               metadata: { op: 'destroy', id: record.prefixed_id })
            { 'id' => record.prefixed_id }
          end
        end

        # The quick-pick row of a branch, replaced as a whole, in order.
        def favorites(store:, staff:, key:, branch:, product_ids:)
          ids = Array(product_ids).map(&:to_s)
          payload = { 'command' => 'menu_favorites.set', 'branch_id' => branch.prefixed_id, 'product_ids' => ids }
          CommandExecutor.call(store: store, actor: staff, key: key, payload: payload,
                               authorize: -> { Guard.manage_branch!(store, staff, branch) }) do
            ModulePolicy.require!(branch, Guard::MODULE)
            raise Conflict.new('Too many favourites.', reason: 'menu_favorites_limit') if ids.size > MenuFavorite::MAX_PER_BRANCH
            raise Conflict.new('A favourite is listed twice.', reason: 'menu_favorites_duplicate') if ids.uniq.size != ids.size

            products = ids.map { |id| Guard.product!(store, id) }
            MenuFavorite.where(branch_id: branch.id).delete_all
            products.each_with_index { |product, index| MenuFavorite.create!(branch: branch, product: product, position: index) }
            AuditEntry.record!(store: store, actor: staff, action: 'menu_favorite.change', subject: branch,
                               metadata: { op: 'replace', product_ids: ids })
            { 'branch_id' => branch.prefixed_id, 'product_ids' => ids }
          end
        end

        def command(store, staff, key, resource, record, attributes, present: :to_pos.to_proc)
          op = record ? 'update' : 'create'
          payload = { 'command' => "#{resource}.#{op}", 'id' => record&.prefixed_id, 'attributes' => attributes }
          CommandExecutor.call(store: store, actor: staff, key: key, payload: payload, authorize: -> { Guard.manage!(store, staff) }) do
            ModulePolicy.require_store!(store, Guard::MODULE)
            saved = yield
            AuditEntry.record!(store: store, actor: staff, action: "#{resource}.change", subject: saved,
                               metadata: { op: op, id: saved.prefixed_id, changes: attributes.except('options', 'items', 'components').keys })
            present.call(saved)
          end
        end

        # One write to a product's POS operating data. Only a prepared product
        # takes any: every other kind sells as an ordinary line, which neither
        # the kitchen nor add-ons touch. Answers the product's whole POS data.
        def product_command(store, staff, key, resource, product, attributes)
          payload = { 'command' => "#{resource}.set", 'product_id' => product.prefixed_id, 'attributes' => attributes }
          CommandExecutor.call(store: store, actor: staff, key: key, payload: payload, authorize: -> { Guard.manage!(store, staff) }) do
            ModulePolicy.require_store!(store, Guard::MODULE)
            unless product.pos_prepared?
              raise Conflict.new('Only a prepared product takes add-ons, a combo or kitchen settings.',
                                 reason: 'product_not_prepared', details: { product_id: product.prefixed_id })
            end

            # Two writes to one product's POS data take turns.
            product.lock!
            yield
            AuditEntry.record!(store: store, actor: staff, action: "#{resource}.change", subject: product,
                               metadata: { op: 'set', id: product.prefixed_id, changes: attributes.keys })
            ProductConfig.to_pos(Spree::Product.includes(*ProductConfig::PRELOAD).find(product.id))
          end
        end

        def variant!(store, variant_id)
          variant = Spree::Variant.find_by_prefix_id(variant_id.to_s)
          raise ActiveRecord::RecordNotFound if variant.nil? || variant.product&.store_id != store.id

          variant
        end

        def rows!(value)
          rows = Array(value)
          raise Conflict.new('Too many rows.', reason: 'menu_rows_limit') if rows.size > MAX_ROWS
          raise Conflict, 'Rows are invalid.' unless rows.all? { |row| row.is_a?(Hash) }

          rows.map { |row| row.to_h.stringify_keys }
        end

        def replace_groups!(store, product, ids)
          raise Conflict, 'A modifier group is listed twice.' if ids.uniq.size != ids.size
          raise Conflict.new('Too many rows.', reason: 'menu_rows_limit') if ids.size > MAX_ROWS

          groups = ids.map { |id| ModifierGroup.locate(ModifierGroup.for_store(store), id) || raise(ActiveRecord::RecordNotFound) }
          product.pos_product_modifier_groups.delete_all
          groups.each_with_index { |group, index| product.pos_product_modifier_groups.create!(modifier_group: group, position: index) }
        end

        def replace_components!(store, product, rows)
          product.pos_combo_components.delete_all
          rows.each do |row|
            product.pos_combo_components.create!(variant: variant!(store, row['variant_id']), quantity: row['quantity'].presence || 1)
          end
        end

        # Options listed with an id are changed, new ones are added, and the
        # ones left out are deleted. Lines already sold keep their copies.
        def replace_options!(store, group, options)
          rows = rows!(options)
          existing = group.modifier_options.index_by(&:prefixed_id)
          kept = rows.filter_map { |row| row['id'].presence&.to_s }
          raise ActiveRecord::RecordNotFound unless (kept - existing.keys).empty?

          existing.except(*kept).each_value(&:destroy!)
          rows.each_with_index do |row, index|
            option = row['id'].present? ? existing.fetch(row['id'].to_s) : group.modifier_options.build
            option.assign_attributes({ 'position' => index }.merge(row.slice(*OPTION_FIELDS)))
            option.variant = row['variant_id'].present? ? variant!(store, row['variant_id']) : nil if row.key?('variant_id')
            option.save!
          end
        end

        def replace_schedule_items!(store, schedule, items)
          rows = rows!(items)
          schedule.menu_schedule_items.delete_all
          rows.each do |row|
            product = Guard.product!(store, row['product_id'])
            variant = row['variant_id'].present? ? variant!(store, row['variant_id']) : nil
            schedule.menu_schedule_items.create!(product: product, variant: variant, price: row['price'].presence,
                                                 hidden: ActiveModel::Type::Boolean.new.cast(row['hidden']) || false)
          end
        end
      end
    end
  end
end
