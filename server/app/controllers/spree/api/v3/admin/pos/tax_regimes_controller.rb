# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The store's tax regime: the one in force with its history, the
          # tax options and their product counts, the year's revenue against
          # the threshold, saving a new one and previewing an unsaved one.
          # Topology writers only.
          class TaxRegimesController < BaseController
            scoped_resource :pos_topology
            pos_permissions show: %w[write_pos_topology], update: %w[write_pos_topology], preview: %w[write_pos_topology]
            rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid

            def show
              return if channel_rejected?

              render_regime(Spree::Pos::TaxRegimes::Save.present(current_store))
            end

            def update
              return if channel_rejected?

              data = Spree::Pos::TaxRegimes::Save.call(store: current_store, actor: current_user, attributes: regime_params,
                                                       apply_to_all_products: params.fetch(:apply_to_all_products, false))
              render_regime(data)
            end

            def preview
              return if channel_rejected?

              render json: { data: Spree::Pos::TaxPreview.call(current_store, regime_params) }
            end

            private

            # The history pages newest first; `page` and `limit` as elsewhere.
            def render_regime(data)
              scope = Spree::Pos::TaxRegime.for_store(current_store).
                      includes(:changed_by, :default_item_tax_category, :default_service_fee_tax_category,
                               :default_shipping_tax_category).order(id: :desc)
              records, meta = page_scope(scope)
              render json: { data: data.merge(history: records.map(&:to_pos)), meta: meta }
            end

            def regime_params
              params.permit(Spree::Pos::TaxRegimes::Save::FIELDS)
            end

            def render_record_invalid(error)
              render_validation_error(error.record.errors)
            end
          end
        end
      end
    end
  end
end
