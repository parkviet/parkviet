# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          class PayrollsController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology],
                            show: %w[read_pos_topology write_pos_topology]

            def index
              return if channel_rejected?

              scope = Spree::Pos::Payroll.for_store(current_store).includes(:branch, :lines).order(payroll_date: :desc, id: :desc)
              term = params[:q].to_s.strip
              if term.present?
                pattern = "%#{ActiveRecord::Base.sanitize_sql_like(term)}%"
                scope = scope.where('code ILIKE :q OR name ILIKE :q OR period_label ILIKE :q', q: pattern)
              end
              scope = scope.where(status: params[:status].to_s) if params[:status].present?
              scope = scope.where(branch_id: branch!(params[:branch_id]).id) if params[:branch_id].present?

              records, meta = page_scope(scope)
              render json: {
                data: records.map { |p| p.to_pos(include_lines: false) },
                meta: meta.merge(next_code: Spree::Pos::Payroll.next_code_for(current_store))
              }
            end

            def show
              return if channel_rejected?

              render json: { data: payroll!.to_pos(include_lines: true) }
            end

            def create
              return if channel_rejected?

              payroll = nil
              ApplicationRecord.transaction do
                payroll = Spree::Pos::Payroll.create!(
                  store: current_store,
                  branch: params[:branch_id].present? ? branch!(params[:branch_id]) : nil,
                  created_by: current_user,
                  code: params[:code].presence,
                  name: params[:name],
                  period_label: params[:period_label],
                  period_start: Date.iso8601(params[:period_start].to_s),
                  period_end: Date.iso8601(params[:period_end].to_s),
                  payroll_date: params[:payroll_date].present? ? Date.iso8601(params[:payroll_date].to_s) : Date.current,
                  note: params[:note],
                  status: 'draft'
                )

                if params[:lines].is_a?(Array)
                  sync_lines!(payroll, params[:lines])
                elsif params[:staff_ids].is_a?(Array)
                  params[:staff_ids].uniq.each_with_index do |staff_prefixed, idx|
                    next if staff_prefixed.blank?

                    payroll.lines.create!(staff: staff!(staff_prefixed), position: idx)
                  end
                end
                payroll.recalculate_totals!
              end

              audit!('payroll.create', payroll, { code: payroll.code, name: payroll.name })
              render json: { data: payroll.reload.to_pos(include_lines: true) }, status: :created
            rescue Date::Error
              raise Spree::Pos::Conflict, 'Invalid date format (expected YYYY-MM-DD).'
            rescue ActiveRecord::RecordNotUnique
              raise Spree::Pos::Conflict, 'Payroll code already exists.'
            end

            def update
              return if channel_rejected?

              payroll = payroll!
              raise Spree::Pos::Conflict, 'Finalized payroll cannot be edited; reopen it first.' if payroll.finalized?

              ApplicationRecord.transaction do
                attrs = {}
                attrs[:name] = params[:name] if params.key?(:name)
                attrs[:period_label] = params[:period_label] if params.key?(:period_label)
                attrs[:period_start] = Date.iso8601(params[:period_start].to_s) if params[:period_start].present?
                attrs[:period_end] = Date.iso8601(params[:period_end].to_s) if params[:period_end].present?
                attrs[:payroll_date] = Date.iso8601(params[:payroll_date].to_s) if params[:payroll_date].present?
                attrs[:note] = params[:note] if params.key?(:note)
                attrs[:branch] = params[:branch_id].present? ? branch!(params[:branch_id]) : nil if params.key?(:branch_id)
                payroll.update!(attrs) if attrs.any?

                sync_lines!(payroll, params[:lines]) if params[:lines].is_a?(Array)
                payroll.recalculate_totals!
              end

              audit!('payroll.update', payroll, { code: payroll.code, total_net: payroll.total_net.to_s('F') })
              render json: { data: payroll.reload.to_pos(include_lines: true) }
            rescue Date::Error
              raise Spree::Pos::Conflict, 'Invalid date format (expected YYYY-MM-DD).'
            end

            def finalize
              return if channel_rejected?

              payroll = payroll!
              payroll.update!(status: 'finalized', finalized_at: Time.current) if payroll.draft?
              audit!('payroll.finalize', payroll, { code: payroll.code, total_net: payroll.total_net.to_s('F') })
              render json: { data: payroll.reload.to_pos(include_lines: true) }
            end

            def reopen
              return if channel_rejected?

              payroll = payroll!
              payroll.update!(status: 'draft', finalized_at: nil) if payroll.finalized?
              audit!('payroll.reopen', payroll, { code: payroll.code })
              render json: { data: payroll.reload.to_pos(include_lines: true) }
            end

            def destroy
              return if channel_rejected?

              payroll = payroll!
              audit!('payroll.delete', payroll, { code: payroll.code, name: payroll.name })
              payroll.destroy!
              head :no_content
            end

            private

            def payroll!
              record = Spree::Pos::Payroll.locate(Spree::Pos::Payroll.for_store(current_store), params[:id])
              raise ActiveRecord::RecordNotFound if record.nil?

              record
            end

            def sync_lines!(payroll, raw_lines)
              keep_staff_ids = []
              raw_lines.each_with_index do |entry, idx|
                next unless entry.respond_to?(:[]) && entry[:staff_id].present?

                user = staff!(entry[:staff_id])
                keep_staff_ids << user.id
                line = payroll.lines.find_or_initialize_by(staff_id: user.id)
                line.position = idx
                Spree::Pos::PayrollLine::NUMERIC_FIELDS.each do |field|
                  line[field] = entry[field] if entry.key?(field) || entry.key?(field.to_s)
                end
                line.note = entry[:note] if entry.key?(:note) || entry.key?('note')
                line.save!
              end
              payroll.lines.where.not(staff_id: keep_staff_ids).destroy_all
            end
          end
        end
      end
    end
  end
end
