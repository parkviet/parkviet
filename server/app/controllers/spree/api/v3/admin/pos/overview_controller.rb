# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The dashboard home page of one branch over a range of business
          # dates: sales totals, by day, hour and source, best sellers, order
          # status counts and stock alerts, optionally with the previous
          # period (`compare=1`). Access, scope and dates are the sales
          # report's (Spree::Pos::Overview).
          class OverviewController < BaseController
            scoped_resource :pos_orders
            pos_permissions show: %w[read_pos_orders read_pos_shifts write_pos_shifts]

            ROUTING_KEYS = %w[controller action format branch_id compare].freeze
            # Only the date range: the previous period repeats it, and no other
            # report filter carries over to every figure of the page.
            FILTER_KEYS = Spree::Pos::Reports::Filters::DATES
            COMPARE = { '0' => false, 'false' => false, '1' => true, 'true' => true }.freeze

            rescue_from Spree::Pos::Reports::Filters::Invalid, with: :render_invalid_filter

            def show
              return if channel_rejected?

              branch = branch!(params[:branch_id])
              scope = Spree::Pos::Reports::Scope.new(store: current_store, staff: current_user, branch: branch)
              overview = Spree::Pos::Overview.new(scope: scope, values: filter_values, compare: compare?)
              render json: { data: overview.to_h }
            end

            private

            def compare?
              value = params[:compare]
              return false if value.nil?
              raise Spree::Pos::Reports::Filters::Invalid, 'Invalid compare.' unless value.is_a?(String) && COMPARE.key?(value)

              COMPARE.fetch(value)
            end

            def filter_values
              values = request.query_parameters.except(*ROUTING_KEYS)
              unknown = values.keys - FILTER_KEYS
              raise Spree::Pos::Reports::Filters::Invalid, "Unknown filter: #{unknown.sort.join(', ')}" if unknown.any?

              values.to_h do |key, value|
                raise Spree::Pos::Reports::Filters::Invalid, "Filter #{key} takes one value." unless value.is_a?(String)

                [key, value]
              end
            end

            def render_invalid_filter(error)
              render_error(code: 'parameter_invalid', message: error.message, status: :unprocessable_content)
            end
          end
        end
      end
    end
  end
end
