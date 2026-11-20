# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The POS operating data of the store's products: operating settings,
          # add-on groups and combo contents (Menu::ProductConfig). Reading
          # lists every prepared product, inactive ones included, with its
          # sizes at list price, for anyone working at a branch of the store.
          # Writing goes through Menu::Save, which checks pos.menu.manage or
          # store administration and takes prepared products only. Product
          # data itself is written through the Admin API.
          class ProductSettingsController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            update: %w[write_pos_orders write_pos_topology],
                            update_combo: %w[write_pos_orders write_pos_topology],
                            update_modifier_groups: %w[write_pos_orders write_pos_topology]

            # meta.tax_defaults: the tax categories the store's F&B setup chose
            # for food and for alcoholic drinks (ids or null), for the product form.
            def index
              read_store!
              products = Spree::Product.where(store_id: current_store.id).pos_prepared(current_store).
                         includes(*Spree::Pos::Menu::ProductConfig::PRELOAD, { variants: [:prices, :option_values] }).
                         order(:name, :id).to_a
              profile = Spree::Pos::StoreProfile.for_store(current_store).includes(:food_tax_category, :alcohol_tax_category).first
              render json: { data: products.map { |product| present(product) },
                             meta: { tax_defaults: profile&.tax_defaults || { food: nil, alcohol: nil } } }
            end

            # PUT /pos/products/:product_id/settings
            def update
              write do |key, product|
                attributes = params.permit(*Spree::Pos::Menu::Save::SETTING_FIELDS, drink_credit_categories: []).to_h
                menu_save.product_settings(store: current_store, staff: current_user, key: key, product: product, attributes: attributes)
              end
            end

            # PUT /pos/products/:product_id/combo with `components: [{ variant_id, quantity }]`.
            def update_combo
              write do |key, product|
                components = params.permit(components: %i[variant_id quantity]).to_h.fetch('components', [])
                menu_save.product_combo(store: current_store, staff: current_user, key: key, product: product, components: components)
              end
            end

            # PUT /pos/products/:product_id/modifier_groups with `modifier_group_ids: [...]`.
            def update_modifier_groups
              write do |key, product|
                menu_save.product_modifier_groups(store: current_store, staff: current_user, key: key, product: product,
                                                  modifier_group_ids: Array(params[:modifier_group_ids]).map(&:to_s))
              end
            end

            private

            def write
              key = idempotency_key
              return if key.nil?

              product = Spree::Pos::Menu::Guard.product!(current_store, params[:product_id])
              render json: { data: yield(key, product) }
            end

            def present(product)
              Spree::Pos::Menu::ProductConfig.to_pos(product).merge(
                variants: product.pos_sizes.map do |variant|
                  price = Spree::Pos::SalesChannel.price(variant, store: current_store, currency: current_store.default_currency)
                  { id: variant.prefixed_id, name: variant.is_master? ? nil : variant.options_text.presence, sku: variant.sku.presence,
                    price: price&.amount&.to_s('F') }
                end
              )
            end

            def read_store!
              access = policy
              return if access.permission?('read_pos_topology') || access.permission?('write_pos_topology')
              raise ActiveRecord::RecordNotFound unless access.memberships.any? { |membership| membership.status == 'active' }
            end

            def menu_save
              Spree::Pos::Menu::Save
            end
          end
        end
      end
    end
  end
end
