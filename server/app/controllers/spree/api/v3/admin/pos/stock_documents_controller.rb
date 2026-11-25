# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # CRUD + complete/cancel/pay workflow for POS stock documents:
          # import (PN), export (PX), stock-taking count (KK), and opening balance (DK).
          class StockDocumentsController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            show: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            create: %w[write_pos_orders write_pos_topology],
                            update: %w[write_pos_orders write_pos_topology],
                            complete: %w[write_pos_orders write_pos_topology],
                            cancel: %w[write_pos_orders write_pos_topology],
                            pay: %w[write_pos_orders write_pos_topology]

            def index
              branch = branch!(params[:branch_id])
              authorize_stock_read!(branch)

              scope = Spree::Pos::StockDocument.for_store(current_store).for_branch(branch)
                                               .includes(:supplier, :customer_profile, :actor, :branch, lines: { variant: :product })
                                               .order(occurred_at: :desc, id: :desc)
              scope = scope.where(kind: params[:kind]) if params[:kind].present? && params[:kind] != 'all'
              scope = scope.where(status: params[:status]) if params[:status].present? && params[:status] != 'all'
              if params[:payment_status].present? && params[:payment_status] != 'all'
                scope = scope.where(payment_status: params[:payment_status])
              end
              if params[:supplier_id].present?
                supplier = Spree::Pos::Supplier.for_store(current_store).find_by_prefix_id(params[:supplier_id].to_s)
                scope = supplier ? scope.where(supplier_id: supplier.id) : scope.none
              end
              if params[:from].present?
                from_t = Date.parse(params[:from].to_s).beginning_of_day rescue nil
                scope = scope.where('occurred_at >= ?', from_t) if from_t
              end
              if params[:to].present?
                to_t = Date.parse(params[:to].to_s).end_of_day rescue nil
                scope = scope.where('occurred_at <= ?', to_t) if to_t
              end
              if params[:q].present?
                q = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].to_s.strip)}%"
                scope = scope.left_joins(:supplier).where(
                  'spree_pos_stock_documents.code ILIKE :q OR spree_pos_stock_documents.counterparty_name ILIKE :q OR spree_pos_stock_documents.note ILIKE :q OR spree_pos_suppliers.name ILIKE :q',
                  q: q
                )
              end

              docs = scope.limit(200).to_a
              render json: {
                data: docs.map(&:to_pos),
                meta: {
                  total: docs.size,
                  total_amount: docs.select { |d| d.status != 'canceled' }.sum(BigDecimal('0'), &:total_amount).to_s('F')
                }
              }
            end

            def show
              doc = find_document!
              authorize_stock_read!(doc.branch)
              render json: { data: doc.to_pos(include_lines: true) }
            end

            def create
              branch = branch!(params[:branch_id])
              authorize_stock_manage!(branch)

              doc = Spree::Pos::StockDocument.new(
                store: current_store,
                branch: branch,
                actor: current_user,
                kind: params[:kind].to_s,
                supplier: resolve_supplier(params[:supplier_id]),
                customer_profile: resolve_customer(params[:customer_id]),
                invoice_type: params[:invoice_type].presence,
                invoice_number: params[:invoice_number].presence,
                export_reason: params[:export_reason].presence,
                counterparty_name: params[:counterparty_name].presence,
                occurred_at: parse_occurred_at(params[:occurred_at]),
                discount_amount: parse_decimal(params[:discount_amount]),
                extra_cost: parse_decimal(params[:extra_cost]),
                tax_rate: parse_decimal(params[:tax_rate]),
                paid_amount: parse_decimal(params[:paid_amount]),
                note: params[:note].presence
              )

              ActiveRecord::Base.transaction do
                doc.save!
                build_lines!(doc, params[:lines])
                doc.recalculate_totals!
                doc.save!
                if ActiveModel::Type::Boolean.new.cast(params[:complete_now])
                  doc.complete!(actor: current_user)
                end
                if doc.kind == 'import' && doc.supplier && doc.paid_amount.positive?
                  Spree::Pos::SupplierPayment.create!(
                    store: current_store,
                    branch: branch,
                    supplier: doc.supplier,
                    stock_document: doc,
                    actor: current_user,
                    amount: doc.paid_amount,
                    payment_method: params[:payment_method].presence || 'cash',
                    occurred_at: doc.occurred_at,
                    note: "Thanh toán khi nhập #{doc.code}"
                  )
                end
              end

              render json: { data: doc.reload.to_pos(include_lines: true) }, status: :created
            end

            def update
              doc = find_document!
              authorize_stock_manage!(doc.branch)
              raise Spree::Pos::ConflictError.new('not_draft') unless doc.status == 'draft'

              ActiveRecord::Base.transaction do
                doc.assign_attributes(
                  supplier: params.key?(:supplier_id) ? resolve_supplier(params[:supplier_id]) : doc.supplier,
                  invoice_type: params.key?(:invoice_type) ? params[:invoice_type].presence : doc.invoice_type,
                  invoice_number: params.key?(:invoice_number) ? params[:invoice_number].presence : doc.invoice_number,
                  export_reason: params.key?(:export_reason) ? params[:export_reason].presence : doc.export_reason,
                  counterparty_name: params.key?(:counterparty_name) ? params[:counterparty_name].presence : doc.counterparty_name,
                  discount_amount: params.key?(:discount_amount) ? parse_decimal(params[:discount_amount]) : doc.discount_amount,
                  extra_cost: params.key?(:extra_cost) ? parse_decimal(params[:extra_cost]) : doc.extra_cost,
                  tax_rate: params.key?(:tax_rate) ? parse_decimal(params[:tax_rate]) : doc.tax_rate,
                  note: params.key?(:note) ? params[:note].presence : doc.note
                )
                if params.key?(:lines)
                  doc.lines.destroy_all
                  build_lines!(doc, params[:lines])
                end
                doc.recalculate_totals!
                doc.save!
              end

              render json: { data: doc.reload.to_pos(include_lines: true) }
            end

            def complete
              doc = find_document!
              authorize_stock_manage!(doc.branch)
              doc.complete!(actor: current_user)
              render json: { data: doc.reload.to_pos(include_lines: true) }
            end

            def cancel
              doc = find_document!
              authorize_stock_manage!(doc.branch)
              doc.cancel!(actor: current_user, reason: params[:reason])
              render json: { data: doc.reload.to_pos(include_lines: true) }
            end

            def pay
              doc = find_document!
              authorize_stock_manage!(doc.branch)
              amount = parse_decimal(params[:amount])
              raise Spree::Pos::ConflictError.new('invalid_amount') unless amount.positive?

              ActiveRecord::Base.transaction do
                doc.paid_amount = doc.paid_amount + amount
                doc.payment_status = doc.compute_payment_status
                doc.save!
                if doc.supplier
                  Spree::Pos::SupplierPayment.create!(
                    store: current_store,
                    branch: doc.branch,
                    supplier: doc.supplier,
                    stock_document: doc,
                    actor: current_user,
                    amount: amount,
                    payment_method: params[:payment_method].presence || 'cash',
                    occurred_at: parse_occurred_at(params[:occurred_at]),
                    note: params[:note].presence || "Thanh toán phiếu nhập #{doc.code}"
                  )
                end
              end

              render json: { data: doc.reload.to_pos(include_lines: true) }
            end

            private

            def find_document!
              doc = Spree::Pos::StockDocument.for_store(current_store).find_by_prefix_id(params[:id].to_s)
              raise ActiveRecord::RecordNotFound if doc.nil?

              doc
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

            def authorize_stock_manage!(branch)
              return if policy.permission?('write_pos_topology')
              return if policy.allows?(branch, Spree::Pos::Capabilities::INVENTORY_MANAGE)

              raise CanCan::AccessDenied
            end

            def resolve_supplier(id)
              return nil if id.blank?

              Spree::Pos::Supplier.for_store(current_store).find_by_prefix_id(id.to_s)
            end

            def resolve_customer(id)
              return nil if id.blank?

              Spree::Pos::CustomerProfile.for_store(current_store).find_by_prefix_id(id.to_s)
            end

            def build_lines!(doc, raw_lines)
              Array(raw_lines).each do |row|
                variant = Spree::Variant.find_by_prefix_id(row[:variant_id].to_s)
                raise ActiveRecord::RecordNotFound if variant.nil? || variant.product&.store_id != current_store.id

                unit_cost = row.key?(:unit_cost) ? parse_decimal(row[:unit_cost]) : (variant.cost_price || BigDecimal('0')).to_d
                item_kind = %w[product ingredient].include?(row[:item_kind].to_s) ? row[:item_kind].to_s : 'product'

                if doc.kind == 'count'
                  level = Spree::StockLevel.find_by(stock_location_id: doc.branch.stock_location_id, variant_id: variant.id)
                  sys_qty = level&.count_on_hand || 0
                  act_qty = row[:actual_quantity].present? ? row[:actual_quantity].to_i : sys_qty
                  diff = act_qty - sys_qty
                  doc.lines.create!(
                    variant: variant,
                    item_kind: item_kind,
                    system_quantity: sys_qty,
                    actual_quantity: act_qty,
                    quantity: diff,
                    unit_cost: unit_cost,
                    line_total: diff.abs * unit_cost,
                    note: row[:note].presence
                  )
                else
                  qty = row[:quantity].to_i
                  next if qty <= 0

                  doc.lines.create!(
                    variant: variant,
                    item_kind: item_kind,
                    quantity: qty,
                    unit_cost: unit_cost,
                    line_total: qty * unit_cost,
                    note: row[:note].presence
                  )
                end
              end
            end

            def parse_decimal(value)
              return BigDecimal('0') if value.blank?

              BigDecimal(value.to_s)
            rescue ArgumentError
              BigDecimal('0')
            end

            def parse_occurred_at(value)
              return Time.current if value.blank?

              Time.zone.parse(value.to_s) || Time.current
            rescue ArgumentError
              Time.current
            end
          end
        end
      end
    end
  end
end
