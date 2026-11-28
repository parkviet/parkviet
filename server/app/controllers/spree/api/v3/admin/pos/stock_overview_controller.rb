# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Real-time stock overview (quantities, cost, valuation, low/out filters)
          # and stock ledger (opening + inflow - outflow = closing) for a branch.
          class StockOverviewController < BaseController
            scoped_resource :pos_orders
            pos_permissions overview: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            ledger: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology]

            def overview
              branch = branch!(params[:branch_id])
              authorize_stock_read!(branch)

              variants = Spree::Variant.joins(:product)
                                       .where(spree_products: { store_id: current_store.id, deleted_at: nil })
                                       .includes(:product, :option_values)
                                       .order('spree_products.name ASC, spree_variants.id ASC')
                                       .to_a

              levels = Spree::StockLevel.where(stock_location_id: branch.stock_location_id, variant_id: variants.map(&:id))
                                        .index_by(&:variant_id)
              alerts = Spree::Pos::StockAlert.where(branch_id: branch.id, variant_id: variants.map(&:id))
                                             .pluck(:variant_id, :min_quantity).to_h
              ingredient_ids = Spree::Pos::RecipeIngredient.joins(:recipe)
                                                           .where(spree_pos_recipes: { store_id: current_store.id })
                                                           .distinct.pluck(:ingredient_variant_id).to_set

              rows = variants.map do |variant|
                level = levels[variant.id]
                on_hand = level&.count_on_hand || 0
                cost = (variant.cost_price || BigDecimal('0')).to_d
                min_qty = alerts[variant.id]
                tracked = variant.track_inventory?
                kind = ingredient_variant?(variant, ingredient_ids) ? 'ingredient' : 'product'
                stock_status = if on_hand <= 0
                                 'out_of_stock'
                               elsif min_qty && on_hand < min_qty
                                 'low'
                               else
                                 'in_stock'
                               end

                {
                  variant_id: variant.prefixed_id,
                  product_id: variant.product.prefixed_id,
                  sku: variant.sku.presence,
                  name: variant.product.name,
                  options_text: variant.options_text.presence,
                  item_kind: kind,
                  base_unit: Spree::Pos::StockIntegration.base_unit_code(variant),
                  track_inventory: tracked,
                  cost_price: cost.to_s('F'),
                  on_hand: on_hand,
                  stock_value: (cost * on_hand).to_s('F'),
                  min_quantity: min_qty,
                  stock_status: stock_status
                }
              end

              summary = {
                total_items: rows.size,
                total_quantity: rows.sum { |r| r[:on_hand] },
                total_value: rows.sum(BigDecimal('0')) { |r| BigDecimal(r[:stock_value]) }.to_s('F'),
                tracked_count: rows.count { |r| r[:track_inventory] },
                untracked_count: rows.count { |r| !r[:track_inventory] },
                low_count: rows.count { |r| r[:stock_status] == 'low' },
                out_of_stock_count: rows.count { |r| r[:stock_status] == 'out_of_stock' }
              }

              filtered = filter_overview(rows)
              render json: { data: filtered, meta: { summary: summary, total: filtered.size } }
            end

            def ledger
              branch = branch!(params[:branch_id])
              authorize_stock_read!(branch)

              level_ids = Spree::StockLevel.where(stock_location_id: branch.stock_location_id).pluck(:id)
              from_time = parse_time(params[:from], start_of_day: true)
              to_time = parse_time(params[:to], start_of_day: false)

              base_scope = Spree::StockMovement.where(stock_level_id: level_ids)
                                               .includes(stock_level: { variant: :product })
              opening_scope = from_time ? base_scope.where('created_at < ?', from_time) : Spree::StockMovement.none
              period_scope = base_scope
              period_scope = period_scope.where('created_at >= ?', from_time) if from_time
              period_scope = period_scope.where('created_at <= ?', to_time) if to_time

              ingredient_ids = Spree::Pos::RecipeIngredient.joins(:recipe)
                                                           .where(spree_pos_recipes: { store_id: current_store.id })
                                                           .distinct.pluck(:ingredient_variant_id).to_set

              opening_value = BigDecimal('0')
              opening_qty = 0
              opening_scope.find_each do |mv|
                cost = movement_cost(mv)
                qty = signed_quantity(mv)
                opening_qty += qty
                opening_value += cost * qty
              end

              movements = period_scope.order(created_at: :desc, id: :desc).limit(300).to_a
              rows = movements.map do |mv|
                variant = mv.stock_level&.variant
                cost = movement_cost(mv)
                qty = signed_quantity(mv)
                kind = variant && ingredient_variant?(variant, ingredient_ids) ? 'ingredient' : 'product'
                doc_code = mv.originator.respond_to?(:code) ? mv.originator.code : nil
                {
                  id: mv.id.to_s,
                  occurred_at: mv.created_at.iso8601,
                  variant_id: variant&.prefixed_id,
                  sku: variant&.sku.presence,
                  name: variant&.product&.name || variant&.sku || '—',
                  item_kind: kind,
                  base_unit: variant ? Spree::Pos::StockIntegration.base_unit_code(variant) : 'cái',
                  movement_kind: mv.action.presence || mv.kind.presence || (qty >= 0 ? 'inflow' : 'outflow'),
                  quantity: qty,
                  unit_cost: cost.to_s('F'),
                  value: (cost * qty).to_s('F'),
                  reference_code: doc_code,
                  reason: mv.reason.presence
                }
              end

              if params[:item_kind].present? && params[:item_kind] != 'all'
                rows = rows.select { |r| r[:item_kind] == params[:item_kind] }
              end
              if params[:movement_kind].present? && params[:movement_kind] != 'all'
                rows = rows.select { |r| r[:movement_kind] == params[:movement_kind] }
              end
              if params[:q].present?
                q = params[:q].to_s.strip.downcase
                rows = rows.select do |r|
                  [r[:name], r[:sku], r[:reference_code], r[:reason]].compact.any? { |f| f.downcase.include?(q) }
                end
              end

              inflow_qty = rows.sum { |r| r[:quantity].positive? ? r[:quantity] : 0 }
              outflow_qty = rows.sum { |r| r[:quantity].negative? ? r[:quantity].abs : 0 }
              inflow_value = rows.sum(BigDecimal('0')) { |r| r[:quantity].positive? ? BigDecimal(r[:value]).abs : BigDecimal('0') }
              outflow_value = rows.sum(BigDecimal('0')) { |r| r[:quantity].negative? ? BigDecimal(r[:value]).abs : BigDecimal('0') }
              closing_value = opening_value + inflow_value - outflow_value

              render json: {
                data: rows,
                meta: {
                  summary: {
                    opening_qty: opening_qty,
                    inflow_qty: inflow_qty,
                    outflow_qty: outflow_qty,
                    closing_qty: opening_qty + inflow_qty - outflow_qty,
                    opening_value: opening_value.to_s('F'),
                    inflow_value: inflow_value.to_s('F'),
                    outflow_value: outflow_value.to_s('F'),
                    closing_value: closing_value.to_s('F')
                  },
                  total: rows.size
                }
              }
            end

            private

            OUTFLOW_MOVEMENT_KINDS = %w[allocated sold picked shipped consumed pos_export].freeze

            def signed_quantity(mv)
              kind = (mv.action.presence || mv.kind.presence).to_s
              qty = mv.quantity.to_i
              return -qty.abs if OUTFLOW_MOVEMENT_KINDS.include?(kind) && qty.positive?

              qty
            end

            def authorize_stock_read!(branch)
              return if policy.permission?('read_pos_topology') || policy.permission?('write_pos_topology')

              allowed = [
                Spree::Pos::Capabilities::INVENTORY_MANAGE,
                Spree::Pos::Capabilities::INVENTORY_TRACE,
                Spree::Pos::Capabilities::REPORT_READ
              ].any? { |cap| policy.allows?(branch, cap) }
              raise CanCan::AccessDenied unless allowed
            end

            def ingredient_variant?(variant, ingredient_ids)
              return true if ingredient_ids.include?(variant.id)

              meta = variant.product&.metadata
              meta.is_a?(Hash) && meta['pos_kind'] == 'ingredient'
            end

            def movement_cost(movement)
              (movement.unit_cost || movement.stock_level&.variant&.cost_price || BigDecimal('0')).to_d
            end

            def filter_overview(rows)
              result = rows
              if params[:item_kind].present? && params[:item_kind] != 'all'
                result = result.select { |r| r[:item_kind] == params[:item_kind] }
              end
              if params[:stock_status].present? && params[:stock_status] != 'all'
                result = result.select { |r| r[:stock_status] == params[:stock_status] }
              end
              if params[:tracked] == 'tracked'
                result = result.select { |r| r[:track_inventory] }
              elsif params[:tracked] == 'untracked'
                result = result.reject { |r| r[:track_inventory] }
              end
              if params[:q].present?
                q = params[:q].to_s.strip.downcase
                result = result.select do |r|
                  [r[:name], r[:sku], r[:options_text]].compact.any? { |f| f.downcase.include?(q) }
                end
              end
              result
            end

            def parse_time(raw, start_of_day:)
              return nil if raw.blank?

              date = Date.parse(raw.to_s)
              start_of_day ? date.beginning_of_day : date.end_of_day
            rescue ArgumentError
              nil
            end
          end
        end
      end
    end
  end
end
