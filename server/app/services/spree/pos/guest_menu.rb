# frozen_string_literal: true

module Spree
  module Pos
    # What a guest's phone reads from the table QR: the branch menu as the
    # counter sells it now (time-of-day prices, hidden items left out,
    # today's sold-out marks), restricted to items open to guests, without
    # anything the guest has no business seeing: SKUs, barcodes, list
    # prices, kitchen routing, tax or cost. Door tickets stay at the counter.
    # A self-ordering kiosk (channel: :kiosk) reads the same menu with
    # every item the counter sells, not only those open to the table QR.
    module GuestMenu
      module_function

      CHANNELS = %i[qr kiosk].freeze

      def call(branch, channel: :qr)
        body = if channel == :qr && emenu?(branch)
                 emenu_body(branch)
               else
                 counter_body(branch, channel)
               end
        if channel == :qr && !body.key?(:theme)
          settings = EmenuSettings.of(branch)
          body = body.merge(theme: theme(branch, settings), sections: sections(branch, settings, body[:items]),
                            payment: payment(branch, settings))
        end
        body.merge(etag: Digest::SHA256.hexdigest(body.to_json)[0, 32])
      end

      # Menu rows of items guests may order, by variant id.
      def variants(branch, channel: :qr)
        rows = if channel == :qr && emenu?(branch)
                 emenu_rows(branch)
               else
                 orderable(branch, Menu::Reader.call(branch: branch)[:items], channel)
               end
        rows.each_with_object({}) do |row, index|
          row[:variants].each { |variant| index[variant[:id]] = row }
        end
      end

      def allowed_item_ids(branch)
        if emenu?(branch)
          EmenuMenu.item_ids(branch)
        else
          orderable(branch, Menu::Reader.call(branch: branch)[:items], :qr).map { |row| row[:id] }.uniq
        end
      end

      def emenu?(branch)
        EmenuCategory.where(branch_id: branch.id).exists?
      end

      def counter_body(branch, channel)
        menu = Menu::Reader.call(branch: branch)
        items = orderable(branch, menu[:items], channel).map { |row| item_row(row) }
        group_ids = items.flat_map { |row| row[:modifier_group_ids] }.to_set
        category_ids = items.filter_map { |row| row[:menu_category_id] }.to_set
        {
          currency: menu[:currency],
          categories: menu[:categories].select { |row| category_ids.include?(row[:id]) }.map do |row|
            row.slice(:id, :name, :position, :color).merge(image_url: nil)
          end,
          items: items,
          modifier_groups: menu[:modifier_groups].select { |row| group_ids.include?(row[:id]) }.map { |row| group_row(row) }
        }
      end

      def orderable(branch, rows, channel = :qr)
        raise ArgumentError, "Unknown menu channel: #{channel}" unless CHANNELS.include?(channel)

        scope = MenuItem.for_store(branch.store).where(drink_credit: nil)
        scope = scope.where(qr_orderable: true) if channel == :qr
        allowed = scope.pluck(:id).
                  to_set { |id| MenuItem.prefixed_for(id) }
        rows.select { |row| allowed.include?(row[:id]) }
      end

      def item_row(row)
        {
          id: row[:id], name: row[:name], kind: row[:kind], menu_category_id: row[:menu_category_id], position: row[:position],
          image_url: row[:image_url], sold_out: row[:sold_out], modifier_group_ids: row[:modifier_group_ids],
          components: row[:components].map { |component| component.slice(:name, :quantity) },
          variants: row[:variants].map { |variant| variant.slice(:id, :name, :price, :price_label) }
        }
      end

      def group_row(row)
        {
          id: row[:id], name: row[:name], min_select: row[:min_select], max_select: row[:max_select],
          allow_quantity: row[:allow_quantity], required: row[:required],
          options: row[:options].select { |option| option[:active] }.map { |option| option.slice(:id, :name, :price_delta, :default_selected) }
        }
      end

      # The branch's own electronic menu, including items a running schedule
      # hides from the counter or products not placed on the counter. Prices
      # and sold-out marks still come from the same menu data the counter uses.
      def emenu_body(branch)
        items = emenu_rows(branch)
        group_ids = items.flat_map { |row| row[:modifier_group_ids] }.to_set
        groups = ModifierGroup.for_store(branch.store).includes(:modifier_options).to_a.
                 select { |group| group_ids.include?(group.prefixed_id) }
        settings = EmenuSettings.of(branch)
        {
          currency: branch.store.default_currency,
          categories: emenu_categories(branch, items),
          items: items,
          modifier_groups: groups.sort_by { |group| [group.position, group.id] }.map { |group| group_row(group.to_pos) },
          theme: theme(branch, settings),
          sections: sections(branch, settings, items),
          payment: payment(branch, settings)
        }
      end

      def emenu_rows(branch)
        now = Workspace.business_now
        sold_out = MenuAvailability.sold_out_ids(branch, BusinessDay.for(branch, now)).to_set
        EmenuCategory.where(branch_id: branch.id).includes(
          emenu_items: { menu_item: [:menu_item_modifier_groups, { combo_components: { variant: :product } },
                                     { product: [:primary_media, { variants: [:prices, :option_values] }] }] }
        ).order(:position, :id).flat_map do |category|
          category.emenu_items.filter_map { |placement| emenu_item(branch, category, placement, sold_out, now) }
        end
      end

      def emenu_item(branch, category, placement, sold_out, now)
        item = placement.menu_item
        product = item&.product
        return if item.nil? || !item.active? || item.drink_credit.present? || product.nil? || product.status != 'active'
        return if (product.available_on.present? && product.available_on > now) ||
                  (product.discontinue_on.present? && product.discontinue_on <= now)

        variants = item.sizes(now: now).filter_map { |variant| emenu_size(branch, item, variant, now) }
        return if variants.empty?

        {
          id: item.prefixed_id, name: product.name, kind: item.kind, menu_category_id: category.prefixed_id,
          position: placement.position, image_url: thumbnail(product), sold_out: sold_out.include?(item.id),
          modifier_group_ids: item.menu_item_modifier_groups.map { |row| row.modifier_group.prefixed_id },
          components: item.combo? ? item.combo_components.map { |component| component.to_pos.slice(:name, :quantity) } : [],
          variants: variants
        }
      end

      def emenu_size(branch, item, variant, now)
        pricing = Menu::Pricing.resolve(branch: branch, variant: variant, selections: [], now: now, currency: branch.store.default_currency,
                                        menu_item: item, allow_hidden: true)
        { id: variant.prefixed_id, name: variant.is_master? ? nil : variant.options_text.presence, price: pricing.unit_price.to_s('F'),
          price_label: pricing.schedule&.label.presence }
      rescue Conflict
        nil
      end

      def emenu_categories(branch, items)
        used = items.to_set { |row| row[:menu_category_id] }
        EmenuCategory.where(branch_id: branch.id).with_attached_image.order(:position, :id).select { |category| used.include?(category.prefixed_id) }.
          map do |category|
            {
              id: category.prefixed_id, name: category.name, position: category.position,
              color: category.color, image_url: category.image_url
            }
          end
      end

      def theme(branch, settings)
        brand = EmenuSettings.brand(branch)
        {
          brand_color: settings['brand_color'], text_color: settings['text_color'], button_color: settings['button_color'],
          logo_url: brand['logo_url'], store_name: brand['store_name']
        }
      end

      def sections(branch, settings, items)
        by_id = items.index_by { |row| row[:id] }
        available = ->(id) { by_id[id] && !by_id[id][:sold_out] }
        best = if settings['best_sellers_enabled'] && settings['best_sellers_source'] == 'auto'
                 Emenu::BestSellers.ids(branch, settings).select { |id| available.call(id) }
               elsif settings['best_sellers_enabled']
                 settings['best_seller_item_ids'].select { |id| available.call(id) }
               else
                 []
               end
        fresh = settings['new_items_enabled'] ? settings['new_item_ids'].select { |id| available.call(id) } : []
        {
          banner: settings['banner_enabled'] ? banners(branch, settings) : [],
          best_sellers: best,
          new_items: fresh
        }
      end

      def banners(branch, settings)
        wanted = settings['banner_promotion_ids']
        return [] if wanted.empty?

        now = Time.current
        TimedPromotion.active.where(branch_id: branch.id).select { |promo| wanted.include?(promo.prefixed_id) }.
          select { |promo| OperatingHours.open?(promo.active_windows, now, branch.timezone) }.
          map { |promo| { id: promo.prefixed_id, name: promo.name } }
      end

      def payment(branch, settings)
        {
          timing: settings['payment_timing'], methods: settings['pay_methods'],
          vietqr_available: !PayLater.receiving_account(branch.store, branch).nil?
        }
      end

      def thumbnail(product)
        image = product.primary_media || product.media.first
        attachment = image.try(:attachment)
        return unless attachment.respond_to?(:attached?) && attachment.attached?

        helpers = Rails.application.routes.url_helpers
        if attachment.respond_to?(:variable?) && attachment.variable?
          helpers.rails_representation_path(attachment.variant(resize_to_limit: Menu::Reader::THUMBNAIL), only_path: true)
        else
          helpers.rails_blob_path(attachment, only_path: true)
        end
      rescue StandardError
        nil
      end
    end
  end
end
