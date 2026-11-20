# frozen_string_literal: true

module Spree
  module Pos
    module Menu
      # The menu a branch sells from right now, in one read: categories,
      # products with their sizes and current prices (a running time-of-day
      # menu applied, hidden products left out), modifier groups, today's
      # sold-out products and the favourites row. Every product the branch
      # sells at the till is listed (Sellable.products); only prepared ones
      # carry add-ons and combo contents (ProductConfig). `etag` changes
      # whenever any of it does.
      #
      # Categories are the store's Spree categories that have a listed product
      # attached directly, in tree order (`lft`); a child category's products
      # are not lifted to its parent. Each product lists the ids of its
      # categories; one without any shows only under "All". Products sort by
      # their first category, their position in it, then name.
      class Reader
        THUMBNAIL = [256, 256].freeze

        def self.call(branch:, now: Workspace.business_now)
          new(branch, now).call
        end

        def initialize(branch, now)
          @branch = branch
          @store = branch.store
          @now = now
        end

        def call
          schedules = Pricing.running_schedules(branch, now)
          business_date = BusinessDay.for(branch, now)
          sold_out = MenuAvailability.sold_out_ids(branch, business_date).to_set
          listed = products.filter_map do |product|
            row = item_row(product, schedules, sold_out)
            [product, row] if row
          end
          categories, links = category_links(listed.map { |product, _| product.id })
          items = sorted_items(listed, categories, links)
          group_ids = items.flat_map { |row| row[:modifier_group_ids] }.uniq
          groups = ModifierGroup.for_store(store).includes(modifier_options: :variant).to_a.
                   select { |group| group_ids.include?(group.prefixed_id) }
          item_ids = items.to_set { |row| row[:product_id] }
          favorites = MenuFavorite.where(branch_id: branch.id).includes(:product).order(:position, :id).
                      filter_map { |row| row.product&.prefixed_id }.select { |id| item_ids.include?(id) }
          body = {
            branch_id: branch.prefixed_id, currency: store.default_currency, business_date: business_date.iso8601,
            module_enabled: ModulePolicy.enabled?(branch, Guard::MODULE),
            categories: category_rows(categories),
            items: items, modifier_groups: groups.sort_by { |group| [group.position, group.id] }.map(&:to_pos),
            schedules: schedules.map { |schedule| { id: schedule.prefixed_id, name: schedule.name, label: schedule.label.presence } },
            favorites: favorites
          }
          body.merge(etag: Digest::SHA256.hexdigest(body.to_json)[0, 32])
        end

        private

        attr_reader :branch, :store, :now

        def products
          Sellable.products(branch).
            includes(*ProductConfig::PRELOAD, :primary_media, { variants: [:prices, :option_values] }).to_a
        end

        # [the store's categories the products are attached to directly, in
        # tree order; { product id => [[category id, position], ...] }].
        def category_links(product_ids)
          links = Spree::ProductCategory.joins(:category).
                  where(product_id: product_ids, spree_categories: { store_id: store.id }).
                  pluck(:product_id, :category_id, :position)
          categories = Spree::Category.where(id: links.map { |row| row[1] }.uniq).order(:lft, :id).to_a
          grouped = links.group_by(&:first).transform_values { |rows| rows.map { |_, category_id, position| [category_id, position.to_i] } }
          [categories, grouped]
        end

        def category_rows(categories)
          parents = Spree::Category.where(id: categories.filter_map(&:parent_id).uniq).to_h { |row| [row.id, row.prefixed_id] }
          categories.map do |category|
            { id: category.prefixed_id, name: category.name, position: category.position.to_i,
              parent_id: category.parent_id && parents[category.parent_id] }
          end
        end

        def sorted_items(listed, categories, links)
          rank = categories.each_with_index.to_h { |category, index| [category.id, index] }
          ids = categories.to_h { |category| [category.id, category.prefixed_id] }
          keyed = listed.map do |product, row|
            placed = links.fetch(product.id, []).sort_by { |category_id, position| [rank.fetch(category_id), position] }
            first = placed.first
            key = first ? [0, rank.fetch(first[0]), first[1]] : [1, 0, 0]
            [[*key, product.name.to_s, product.id], row.merge(category_ids: placed.map { |category_id, _| ids.fetch(category_id) })]
          end
          keyed.sort_by(&:first).map(&:last)
        end

        def item_row(product, schedules, sold_out)
          variants = product.pos_sizes(now: now).filter_map { |variant| size_row(product, variant, schedules) }
          return if variants.empty?

          ProductConfig.to_pos(product).merge(
            image_url: image_url(product), sold_out: sold_out.include?(product.id), variants: variants
          )
        end

        # A time-of-day menu prices and hides only prepared products: they are
        # the ones sold as menu lines.
        def size_row(product, variant, schedules)
          scheduled, schedule = if product.pos_prepared?
                                  Pricing.scheduled_price(branch, product, variant, now, schedules: schedules)
                                else
                                  [nil, nil]
                                end
          list = SalesChannel.price(variant, store: store, currency: store.default_currency)&.amount
          price = scheduled || list
          return if price.nil?

          {
            id: variant.prefixed_id, name: variant.is_master? ? nil : variant.options_text.presence, sku: variant.sku.presence,
            barcode: variant.barcode.presence, price: price.to_s('F'), list_price: list&.to_s('F'),
            schedule_id: schedule&.prefixed_id, price_label: schedule&.label.presence
          }
        rescue Conflict => e
          raise unless e.reason == 'product_hidden'

          nil
        end

        # A small rendition of the product's first image, or nil. A broken
        # attachment must not stop the menu from loading.
        def image_url(product)
          image = product.primary_media || product.media.first
          attachment = image.try(:attachment)
          return unless attachment.respond_to?(:attached?) && attachment.attached?

          helpers = Rails.application.routes.url_helpers
          if attachment.respond_to?(:variable?) && attachment.variable?
            helpers.rails_representation_path(attachment.variant(resize_to_limit: THUMBNAIL), only_path: true)
          else
            helpers.rails_blob_path(attachment, only_path: true)
          end
        rescue StandardError => e
          Rails.logger.warn("[pos] menu image for #{product.prefixed_id} failed: #{e.class}: #{e.message}")
          nil
        end
      end
    end
  end
end
