# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The store's tax declaration details: the tax profile, the taxpayer
          # fields shared with the store information, the branches as business
          # locations and how many required fields are filled.
          class TaxProfilesController < BaseController
            scoped_resource :pos_topology
            pos_permissions show: %w[read_pos_topology write_pos_topology]
            rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid

            def show
              return if channel_rejected?

              render json: { data: Spree::Pos::TaxProfiles::Save.present(current_store) }
            end

            def update
              return if channel_rejected?

              data = Spree::Pos::TaxProfiles::Save.call(
                store: current_store, actor: current_user, attributes: profile_params,
                locations: params.key?(:locations) ? locations_param : nil
              )
              render json: { data: data }
            end

            private

            def profile_params
              params.permit(Spree::Pos::TaxProfiles::Save::SHARED + Spree::Pos::TaxProfile::FIELDS)
            end

            # Anything but a list of rows is refused by the workflow.
            def locations_param
              value = params[:locations]
              return value unless value.is_a?(Array)

              value.map do |row|
                row.respond_to?(:permit) ? row.permit(:branch_id, *Spree::Pos::TaxProfiles::Save::LOCATION_FIELDS) : row
              end
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
