# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Vietnam's provinces and the wards of one province. The catalog is
          # static, so the response can be cached for a day.
          class AdminUnitsController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology read_pos_orders]

            def index
              return if channel_rejected?

              expires_in 1.day, public: false
              fresh_when(etag: Spree::Pos::AdminUnits.etag, public: false)
              return if performed?

              data = if params[:province].present?
                       wards = Spree::Pos::AdminUnits.wards(params[:province])
                       raise ActiveRecord::RecordNotFound if wards.nil?

                       { province: params[:province], wards: wards }
                     else
                       { provinces: Spree::Pos::AdminUnits.provinces }
                     end
              render json: { data: data }
            end
          end
        end
      end
    end
  end
end
