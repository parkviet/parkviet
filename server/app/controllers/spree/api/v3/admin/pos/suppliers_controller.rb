# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Store-scoped suppliers with import volume, payable balance, and payment history.
          class SuppliersController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            show: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            create: %w[write_pos_orders write_pos_topology],
                            update: %w[write_pos_orders write_pos_topology],
                            record_payment: %w[write_pos_orders write_pos_topology]

            def index
              suppliers = Spree::Pos::Supplier.for_store(current_store)
                                              .includes(:partner_group, :customer_profile)
                                              .order(created_at: :desc)
                                              .to_a
              stats_map = build_stats(suppliers.map(&:id))
              rows = suppliers.map { |s| s.to_pos(stats: stats_map[s.id]) }

              summary = {
                total_suppliers: rows.size,
                total_imports: rows.sum { |r| r[:import_count] },
                total_imported_value: rows.sum(BigDecimal('0')) { |r| BigDecimal(r[:imported_total]) }.to_s('F'),
                total_payable: rows.sum(BigDecimal('0')) { |r| [BigDecimal(r[:payable_balance]), BigDecimal('0')].max }.to_s('F')
              }

              filtered = filter_rows(rows)
              render json: { data: filtered, meta: { summary: summary, total: filtered.size } }
            end

            def show
              supplier = find_supplier!
              stats = build_stats([supplier.id])[supplier.id]
              imports = Spree::Pos::StockDocument.for_store(current_store)
                                                 .where(supplier_id: supplier.id, kind: 'import')
                                                 .includes(:branch, :supplier, :actor, lines: { variant: :product })
                                                 .order(occurred_at: :desc)
                                                 .limit(50)
              payments = Spree::Pos::SupplierPayment.for_store(current_store)
                                                    .where(supplier_id: supplier.id)
                                                    .includes(:branch, :stock_document, :actor)
                                                    .order(occurred_at: :desc)
                                                    .limit(50)

              render json: {
                data: supplier.to_pos(stats: stats).merge(
                  imports: imports.map(&:to_pos),
                  payments: payments.map(&:to_pos)
                )
              }
            end

            def create
              supplier = Spree::Pos::Supplier.new(supplier_attributes)
              supplier.store = current_store
              supplier.created_by = current_user
              supplier.save!
              render json: { data: supplier.to_pos }, status: :created
            end

            def update
              supplier = find_supplier!
              supplier.update!(supplier_attributes)
              stats = build_stats([supplier.id])[supplier.id]
              render json: { data: supplier.to_pos(stats: stats) }
            end

            def record_payment
              supplier = find_supplier!
              branch = branch!(params[:branch_id])
              amount = BigDecimal(params[:amount].to_s)
              raise Spree::Pos::ConflictError.new('invalid_amount') unless amount.positive?

              doc = if params[:stock_document_id].present?
                      Spree::Pos::StockDocument.for_store(current_store).find_by_prefix_id(params[:stock_document_id].to_s)
                    end

              payment = nil
              ActiveRecord::Base.transaction do
                payment = Spree::Pos::SupplierPayment.create!(
                  store: current_store,
                  branch: branch,
                  supplier: supplier,
                  stock_document: doc,
                  actor: current_user,
                  amount: amount,
                  payment_method: params[:payment_method].presence || 'cash',
                  occurred_at: params[:occurred_at].present? ? (Time.zone.parse(params[:occurred_at].to_s) || Time.current) : Time.current,
                  note: params[:note].presence
                )
                if doc
                  doc.paid_amount = doc.paid_amount + amount
                  doc.payment_status = doc.compute_payment_status
                  doc.save!
                end
              end

              render json: { data: payment.to_pos }, status: :created
            end

            private

            def find_supplier!
              supplier = Spree::Pos::Supplier.for_store(current_store).find_by_prefix_id(params[:id].to_s)
              raise ActiveRecord::RecordNotFound if supplier.nil?

              supplier
            end

            def supplier_attributes
              attrs = {}
              %i[code name phone email address tax_code invoice_company invoice_address bank_name bank_account status note].each do |f|
                attrs[f] = params[f] if params.key?(f)
              end
              attrs[:tags] = params[:tags] if params.key?(:tags)
              attrs[:also_customer] = ActiveModel::Type::Boolean.new.cast(params[:also_customer]) if params.key?(:also_customer)
              if params.key?(:opening_payable)
                attrs[:opening_payable] = params[:opening_payable].present? ? BigDecimal(params[:opening_payable].to_s) : BigDecimal('0')
              end
              if params.key?(:partner_group_id)
                attrs[:partner_group] = params[:partner_group_id].present? ?
                  Spree::Pos::PartnerGroup.for_store(current_store).of_kind('supplier').find_by_prefix_id(params[:partner_group_id].to_s) : nil
              end
              attrs
            end

            def build_stats(supplier_ids)
              return {} if supplier_ids.empty?

              imports = Spree::Pos::StockDocument.for_store(current_store)
                                                 .where(supplier_id: supplier_ids, kind: 'import', status: 'completed')
                                                 .group(:supplier_id)
                                                 .pluck(:supplier_id, Arel.sql('COUNT(*)'), Arel.sql('COALESCE(SUM(total_amount), 0)'))
              payments = Spree::Pos::SupplierPayment.for_store(current_store)
                                                    .where(supplier_id: supplier_ids)
                                                    .group(:supplier_id)
                                                    .sum(:amount)
              map = Hash.new { |h, k| h[k] = { import_count: 0, imported_total: BigDecimal('0'), paid_total: BigDecimal('0') } }
              imports.each do |sid, cnt, total|
                map[sid][:import_count] = cnt.to_i
                map[sid][:imported_total] = total.to_d
              end
              payments.each do |sid, paid|
                map[sid][:paid_total] = paid.to_d
              end
              map
            end

            def filter_rows(rows)
              result = rows
              if params[:status].present? && params[:status] != 'all'
                result = result.select { |r| r[:status] == params[:status] }
              end
              if params[:partner_group_id].present? && params[:partner_group_id] != 'all'
                result = result.select { |r| r[:partner_group_id] == params[:partner_group_id] }
              end
              if params[:debt_filter] == 'shop_owes'
                result = result.select { |r| BigDecimal(r[:payable_balance]).positive? }
              elsif params[:debt_filter] == 'supplier_owes'
                result = result.select { |r| BigDecimal(r[:payable_balance]).negative? }
              end
              if params[:q].present?
                q = params[:q].to_s.strip.downcase
                result = result.select do |r|
                  [r[:name], r[:code], r[:phone], r[:tax_code], r[:email]].compact.any? { |f| f.downcase.include?(q) }
                end
              end
              case params[:sort]
              when 'name_asc' then result.sort_by { |r| r[:name].to_s.downcase }
              when 'name_desc' then result.sort_by { |r| r[:name].to_s.downcase }.reverse
              when 'imported_desc' then result.sort_by { |r| -BigDecimal(r[:imported_total]) }
              when 'payable_desc' then result.sort_by { |r| -BigDecimal(r[:payable_balance]) }
              else result
              end
            end
          end
        end
      end
    end
  end
end
