# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Low-stock thresholds of a branch with what its shelf shows now,
          # lowest first. Reading takes pos.inventory.manage or
          # pos.report.read at the branch; changing takes pos.inventory.manage
          # (Recipes::SetStockAlert). Both answer with the branch's list.
          class StockAlertsController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            update: %w[write_pos_orders write_pos_topology]

            def index
              branch = branch!(params[:branch_id])
              read!(branch)
              render json: { data: alerts(branch) }
            end

            def update
              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              variant = Spree::Variant.find_by_prefix_id(params[:variant_id].to_s)
              raise ActiveRecord::RecordNotFound if variant.nil? || variant.product&.store_id != current_store.id

              Spree::Pos::Recipes::SetStockAlert.call(store: current_store, staff: current_user, key: key, branch: branch,
                                                      variant: variant, min_quantity: params[:min_quantity])
              render json: { data: alerts(branch) }
            end

            private

            def read!(branch)
              raise CanCan::AccessDenied unless Spree::Pos::StockAlert.readable?(policy, branch)
            end

            def alerts(branch)
              Spree::Pos::StockAlert.board(branch)
            end
          end
        end
      end
    end
  end
end
