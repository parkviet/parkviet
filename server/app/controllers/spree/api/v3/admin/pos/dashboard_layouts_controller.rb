# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The signed-in user's own arrangement of the POS dashboard home
          # widgets in the current store. Anyone who can load the dashboard
          # context may keep one; nobody reads or writes another user's.
          # The last write wins.
          class DashboardLayoutsController < BaseController
            ACCESS = %w[read_pos_orders read_pos_topology write_pos_topology].freeze

            scoped_resource :pos_orders
            pos_permissions show: ACCESS, update: ACCESS, destroy: ACCESS

            def show
              render json: { data: own_layouts.first&.to_pos }
            end

            def update
              body = request.request_parameters
              unless body.key?('layout')
                return render_error(code: 'parameter_missing', message: 'layout is required.', status: :unprocessable_content)
              end

              record = save(body['layout'])
              return render_validation_error(record.errors) if record.errors.any?

              render json: { data: record.to_pos }
            end

            def destroy
              own_layouts.delete_all
              head :no_content
            end

            private

            def own_layouts
              Spree::Pos::DashboardLayout.where(store_id: current_store.id, user_id: current_user.id)
            end

            # Two tabs saving at once race on the unique key; the loser
            # retries once and overwrites, so the later write wins.
            def save(layout, retried: false)
              record = own_layouts.first_or_initialize
              record.assign_attributes(layout: layout, version: Spree::Pos::DashboardLayout::FORMAT_VERSION)
              record.save
              record
            rescue ActiveRecord::RecordNotUnique
              raise if retried

              save(layout, retried: true)
            end
          end
        end
      end
    end
  end
end
