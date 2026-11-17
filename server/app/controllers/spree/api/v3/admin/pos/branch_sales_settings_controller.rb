# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Partial update of a branch's selling options. Store topology
          # writers, and the branch's manager. Unknown keys are 422.
          class BranchSalesSettingsController < BaseController
            scoped_resource :pos_topology
            MANAGERS = %w[read_pos_orders read_pos_topology write_pos_topology].freeze
            pos_permissions update: MANAGERS

            def update
              return if channel_rejected?

              branch = branch!(params[:branch_id])
              data = Spree::Pos::SalesSettings::Update.call(store: current_store, actor: current_user, branch: branch,
                                                            attributes: sales_attributes)
              render json: { data: data }
            rescue Spree::Pos::SalesSettings::Invalid => error
              render_error(code: 'validation_error', message: error.message, status: :unprocessable_content,
                           details: { field: error.field })
            end

            private

            def sales_attributes
              raw = params[:sales_settings]
              source = raw.respond_to?(:to_unsafe_h) ? raw.to_unsafe_h : params.to_unsafe_h
              source.slice(*Spree::Pos::SalesSettings::KEYS)
            end
          end
        end
      end
    end
  end
end