# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Store-wide shift history for the Staff > Shifts screen: filterable by
          # date range, branch, staff, and status, with closure cash variance details.
          class StaffShiftsController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology read_pos_orders write_pos_orders]

            def index
              return if channel_rejected?

              scope = Spree::Pos::Shift.for_store(current_store)
                .includes(:branch, :register, :owner, :closure)
                .order(opened_at: :desc, id: :desc)

              unless policy.permission?('read_pos_topology') || policy.permission?('write_pos_topology')
                scope = scope.where(owner_id: current_user.id)
              end

              scope = scope.where(branch_id: branch!(params[:branch_id]).id) if params[:branch_id].present?
              scope = scope.where(owner_id: staff!(params[:staff_id]).id) if params[:staff_id].present?
              scope = scope.where(status: params[:status].to_s) if %w[open closed].include?(params[:status].to_s)

              if params[:from].present?
                from_date = Date.iso8601(params[:from].to_s)
                scope = scope.where('business_date >= ?', from_date)
              end
              if params[:to].present?
                to_date = Date.iso8601(params[:to].to_s)
                scope = scope.where('business_date <= ?', to_date)
              end

              all_count = scope.count
              open_count = scope.where(status: 'open').count
              records, meta = page_scope(scope)

              render json: {
                data: records.map { |shift| serialize_shift(shift) },
                meta: meta.merge(
                  summary: {
                    total: all_count,
                    open: open_count,
                    closed: all_count - open_count
                  }
                )
              }
            rescue Date::Error
              raise Spree::Pos::Conflict, 'Invalid date format (expected YYYY-MM-DD).'
            end

            private

            def serialize_shift(shift)
              closure = shift.closure
              end_time = shift.closed_at || Time.current
              duration_minutes = shift.opened_at ? ((end_time - shift.opened_at) / 60).round : 0
              {
                id: shift.prefixed_id,
                status: shift.status,
                business_date: shift.business_date&.iso8601,
                opened_at: shift.opened_at&.iso8601,
                closed_at: shift.closed_at&.iso8601,
                duration_minutes: duration_minutes,
                currency: shift.currency,
                opening_float: shift.opening_float.to_s('F'),
                branch_id: shift.branch.prefixed_id,
                branch_name: shift.branch.name,
                register_id: shift.register&.prefixed_id,
                register_name: shift.register&.name,
                staff_id: shift.owner.prefixed_id,
                staff_name: shift.owner.full_name.presence || shift.owner.email,
                staff_email: shift.owner.email,
                expected_cash: closure ? closure.expected.to_s('F') : shift.opening_float.to_s('F'),
                counted_cash: closure ? closure.counted.to_s('F') : nil,
                variance: closure ? closure.variance.to_s('F') : nil,
                inflow_total: closure ? closure.inflow_total.to_s('F') : '0.0',
                outflow_total: closure ? closure.outflow_total.to_s('F') : '0.0',
                reason: closure&.reason,
                breakdown: closure&.breakdown || {}
              }
            end
          end
        end
      end
    end
  end
end
