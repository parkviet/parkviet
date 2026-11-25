# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Admin-facing Partners > Customers directory backed by Spree::Pos::CustomerProfile,
          # enriched with partner group, invoice info, order totals, and receivable balance.
          class PartnerCustomersController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            show: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            create: %w[write_pos_orders write_pos_topology],
                            update: %w[write_pos_orders write_pos_topology]

            def index
              customers = Spree::Pos::CustomerProfile.for_store(current_store)
                                                     .includes(:partner_group, :customer)
                                                     .order(created_at: :desc)
                                                     .to_a
              receivables = receivable_balances(customers.map(&:id))
              rows = customers.map do |c|
                bal = receivables[c.id] || BigDecimal('0')
                c.to_pos.merge(receivable_balance: bal.to_s('F'))
              end

              summary = {
                total_customers: rows.size,
                active_count: rows.count { |r| r[:status] == 'active' },
                total_receivable: rows.sum(BigDecimal('0')) { |r| [BigDecimal(r[:receivable_balance]), BigDecimal('0')].max }.to_s('F'),
                debtors_count: rows.count { |r| BigDecimal(r[:receivable_balance]).positive? }
              }

              filtered = filter_rows(rows)
              render json: { data: filtered, meta: { summary: summary, total: filtered.size } }
            end

            def show
              profile = find_customer!
              bal = receivable_balances([profile.id])[profile.id] || BigDecimal('0')
              entries = Spree::Pos::ReceivableEntry.joins(:credit_account)
                                                   .where(store_id: current_store.id, spree_pos_credit_accounts: { customer_profile_id: profile.id })
                                                   .order(created_at: :desc)
                                                   .limit(30)
                                                   .map do |e|
                {
                  id: e.prefixed_id,
                  kind: e.kind,
                  amount: e.amount.to_s('F'),
                  occurred_at: e.created_at&.iso8601,
                  note: e.respond_to?(:reason) ? e.reason.presence : nil
                }
              end

              render json: {
                data: profile.to_pos.merge(
                  receivable_balance: bal.to_s('F'),
                  recent_receivables: entries
                )
              }
            end

            def create
              profile = Spree::Pos::CustomerProfile.new(customer_attributes)
              profile.store = current_store
              profile.created_by = current_user
              profile.save!
              render json: { data: profile.to_pos.merge(receivable_balance: '0.0') }, status: :created
            end

            def update
              profile = find_customer!
              profile.update!(customer_attributes)
              bal = receivable_balances([profile.id])[profile.id] || BigDecimal('0')
              render json: { data: profile.to_pos.merge(receivable_balance: bal.to_s('F')) }
            end

            private

            def find_customer!
              profile = Spree::Pos::CustomerProfile.for_store(current_store).find_by_prefix_id(params[:id].to_s)
              raise ActiveRecord::RecordNotFound if profile.nil?

              profile
            end

            def customer_attributes
              attrs = {}
              %i[code name phone email address tax_code invoice_company invoice_address gender status note].each do |f|
                attrs[f] = params[f] if params.key?(f)
              end
              attrs[:birthday] = params[:birthday].presence if params.key?(:birthday)
              attrs[:tags] = params[:tags] if params.key?(:tags)
              attrs[:also_supplier] = ActiveModel::Type::Boolean.new.cast(params[:also_supplier]) if params.key?(:also_supplier)
              if params.key?(:partner_group_id)
                attrs[:partner_group] = params[:partner_group_id].present? ?
                  Spree::Pos::PartnerGroup.for_store(current_store).of_kind('customer').find_by_prefix_id(params[:partner_group_id].to_s) : nil
              end
              attrs
            end

            def receivable_balances(profile_ids)
              return {} if profile_ids.empty?

              Spree::Pos::ReceivableEntry.joins(:credit_account)
                                         .where(store_id: current_store.id, spree_pos_credit_accounts: { customer_profile_id: profile_ids })
                                         .group('spree_pos_credit_accounts.customer_profile_id')
                                         .sum(Arel.sql(Spree::Pos::ReceivableEntry::SIGNED_SQL))
            end

            def filter_rows(rows)
              result = rows
              if params[:status].present? && params[:status] != 'all'
                result = result.select { |r| r[:status] == params[:status] }
              end
              if params[:partner_group_id].present? && params[:partner_group_id] != 'all'
                result = result.select { |r| r[:partner_group_id] == params[:partner_group_id] }
              end
              if params[:debt_filter] == 'customer_owes'
                result = result.select { |r| BigDecimal(r[:receivable_balance]).positive? }
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
              when 'debt_desc' then result.sort_by { |r| -BigDecimal(r[:receivable_balance]) }
              else result
              end
            end
          end
        end
      end
    end
  end
end
