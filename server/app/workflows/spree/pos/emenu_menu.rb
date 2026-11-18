# frozen_string_literal: true

module Spree
  module Pos
    # Replaces a branch's electronic menu in one write: categories in order,
    # and the store's menu items inside each one. A category id that is sent
    # again keeps its image.
    module EmenuMenu
      MAX_CATEGORIES = 30
      MAX_ITEMS = 80

      module_function

      def read(branch)
        EmenuCategory.where(branch_id: branch.id).includes(emenu_items: :menu_item).order(:position, :id).map(&:to_pos)
      end

      def item_ids(branch)
        EmenuItem.joins(:emenu_category).where(spree_pos_emenu_categories: { branch_id: branch.id }).
          distinct.pluck(:menu_item_id).map { |id| MenuItem.prefixed_for(id) }
      end

      def replace!(store:, actor:, key:, branch:, categories:)
        GuestOrders::Guard.codes!(store, actor, branch)
        tree = normalize!(store, categories)
        payload = { 'command' => 'emenu.menu', 'branch_id' => branch.prefixed_id, 'categories' => tree }
        CommandExecutor.call(store: store, actor: actor, key: key, payload: payload, authorize: -> {}) do
          ApplicationRecord.transaction do
            branch.lock!
            kept = tree.each_with_index.map { |row, index| write_category!(branch, row, index) }
            EmenuCategory.where(branch_id: branch.id).where.not(id: kept).destroy_all
            prune_settings_items!(branch)
          end
          AuditEntry.record!(store: store, actor: actor, action: 'emenu.update', subject: branch,
                             metadata: { branch_id: branch.prefixed_id, menu: true, categories: tree.size })
          read(branch)
        end
      end

      # Copies the counter's categories and the items open to the table QR,
      # as a starting menu. Replaces whatever the electronic menu held.
      def import!(store:, actor:, key:, branch:)
        menu = Menu::Reader.call(branch: branch)
        allowed = MenuItem.for_store(store).where(qr_orderable: true).pluck(:id).to_set { |id| MenuItem.prefixed_for(id) }
        categories = menu[:categories].filter_map do |category|
          items = menu[:items].select { |item| item[:menu_category_id] == category[:id] && allowed.include?(item[:id]) }
          next if items.empty?

          { 'name' => category[:name], 'color' => category[:color], 'items' => items.sort_by { |item| item[:position] }.map { |item| item[:id] } }
        end
        replace!(store: store, actor: actor, key: key, branch: branch, categories: categories)
      end

      def attach_image!(store:, actor:, branch:, category_id:, io:, filename:, content_type:)
        GuestOrders::Guard.codes!(store, actor, branch)
        category = EmenuCategory.locate(EmenuCategory.where(branch_id: branch.id), category_id)
        raise ActiveRecord::RecordNotFound if category.nil?
        raise EmenuSettings::Invalid, 'image' unless %w[image/png image/jpeg].include?(content_type.to_s)
        raise EmenuSettings::Invalid, 'image' if io.respond_to?(:size) && io.size > 2.megabytes

        category.image.attach(io: io, filename: filename, content_type: content_type)
        AuditEntry.record!(store: store, actor: actor, action: 'emenu.update', subject: branch,
                           metadata: { branch_id: branch.prefixed_id, category_id: category.prefixed_id, image: true })
        category.to_pos
      end

      def normalize!(store, categories)
        raise EmenuSettings::Invalid, 'categories' unless categories.is_a?(Array) && categories.size <= MAX_CATEGORIES

        categories.map do |row|
          raise EmenuSettings::Invalid, 'categories' unless row.is_a?(Hash)

          row = row.stringify_keys
          name = row['name'].to_s.strip
          color = row['color'].presence
          items = Array(row['items'])
          raise EmenuSettings::Invalid, 'name' unless name.length.between?(1, 80)
          raise EmenuSettings::Invalid, 'color' if color && !color.match?(EmenuCategory::COLOR)
          raise EmenuSettings::Invalid, 'items' unless items.size <= MAX_ITEMS

          seen_in_category = {}
          ids = items.map do |item|
            id = item.is_a?(Hash) ? item.stringify_keys['menu_item_id'] : item
            raise EmenuSettings::Invalid, 'items' unless id.is_a?(String)
            raise EmenuSettings::Invalid, 'items' if seen_in_category[id]

            seen_in_category[id] = true
            id
          end
          raise EmenuSettings::Invalid, 'items' unless ids.all? { |id| menu_item!(store, id) }

          { 'id' => row['id'].to_s.presence, 'name' => name, 'color' => color, 'items' => ids }
        end
      end

      def menu_item!(store, id)
        item = MenuItem.find_by_prefix_id(id)
        raise EmenuSettings::Invalid, 'items' if item.nil? || item.store_id != store.id

        item
      end

      def write_category!(branch, row, index)
        found = row['id'] && EmenuCategory.find_by_prefix_id(row['id'])
        category = found if found&.branch_id == branch.id
        category ||= EmenuCategory.new(branch: branch)
        category.update!(name: row['name'], color: row['color'], position: index)
        kept_items = row['items'].each_with_index.map do |menu_item_id, position|
          menu_item = menu_item!(branch.store, menu_item_id)
          item = category.emenu_items.find_by(menu_item_id: menu_item.id) || category.emenu_items.build(menu_item: menu_item)
          item.update!(position: position)
          item.id
        end
        category.emenu_items.where.not(id: kept_items).delete_all
        category.id
      end

      def prune_settings_items!(branch)
        raw = branch.emenu_settings
        return unless raw.is_a?(Hash) && (raw['best_seller_item_ids'].present? || raw['new_item_ids'].present?)

        allowed = GuestMenu.allowed_item_ids(branch).to_set
        updated = raw.dup
        %w[best_seller_item_ids new_item_ids].each do |field|
          updated[field] = Array(updated[field]).select { |id| allowed.include?(id) } if updated.key?(field)
        end
        branch.update!(emenu_settings: updated) if updated != raw
      end
    end
  end
end
