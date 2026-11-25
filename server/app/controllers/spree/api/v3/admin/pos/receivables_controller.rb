# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Receivables of one branch from the immutable ledger. Any member of
          # the branch may read them; contact details are masked unless the
          # reader collects, approves or manages credit there.
          class ReceivablesController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders],
                            customers: %w[read_pos_orders write_pos_orders],
                            ledger: %w[read_pos_orders write_pos_orders],
                            remind: %w[write_pos_orders],
                            promised_pay_on: %w[write_pos_orders]

            STATUSES = %w[open overdue settled all].freeze
            UNMASKED = [Spree::Pos::Capabilities::PAYMENT, Spree::Pos::Capabilities::APPROVE,
                        Spree::Pos::Capabilities::CREDIT_MANAGE].freeze
            # A reminder lists at most this many open orders; `orders` counts all.
            REMINDER_ORDERS = 20

            def index
              return if channel_rejected?

              branch = readable_branch!
              projection = projection_for(branch)
              oldest_due_first = Arel.sql('MAX(spree_pos_receivable_entries.due_on) ASC, spree_pos_receivable_entries.order_id ASC')
              rows_scope = projection.order_rows(status: status_param).reorder(oldest_due_first)
              records, meta = page_rows(rows_scope)
              render json: { data: serialize(projection, records, mask?(branch), branch), meta: meta }
            end

            # "Khách nợ": one row per customer who owes at the branch (or settled
            # all debts when `status=settled`), with balance, overdue, aging,
            # promised pay date, how long the oldest debt has been open, when
            # they were last reminded, and what a reminder lists.
            def customers
              return if channel_rejected?

              branch = readable_branch!
              projection = projection_for(branch)
              filter = params[:status].to_s.presence || 'open'
              raise Spree::Pos::Conflict, 'Status filter is invalid.' unless %w[open settled all].include?(filter)

              open_rows = projection.order_rows(status: 'open').to_a
              settled_rows = projection.order_rows(status: 'settled').to_a
              open_by_account = open_rows.group_by(&:credit_account_id)
              settled_only_by_account = settled_rows.group_by(&:credit_account_id).reject { |aid, _| open_by_account.key?(aid) }

              target_groups = case filter
                              when 'settled' then settled_only_by_account
                              when 'all' then open_by_account.merge(settled_only_by_account)
                              else open_by_account
                              end

              account_ids = target_groups.keys
              order_ids = target_groups.values.flatten.map(&:order_id).uniq
              accounts = Spree::Pos::CreditAccount.where(id: account_ids).includes(:customer_profile).index_by(&:id)
              orders = Spree::Order.where(id: order_ids).index_by(&:id)
              last_entries = Spree::Pos::ReceivableEntry.for_store(current_store).
                             where(branch_id: branch.id, credit_account_id: account_ids).
                             group(:credit_account_id).maximum(:created_at)
              context = { projection: projection, orders: orders, mask: mask?(branch), branch: branch,
                          last_entries: last_entries,
                          receiving: Spree::Pos::PayLater.receiving_account(current_store, branch) }
              data = target_groups.map do |account_id, account_rows|
                if open_by_account.key?(account_id)
                  customer_row(accounts.fetch(account_id), account_rows, context)
                else
                  settled_customer_row(accounts.fetch(account_id), account_rows, context)
                end
              end
              data.sort_by! { |row| [-row['days_overdue'].to_i, -BigDecimal(row['balance']), row['customer'][:name].to_s] }
              render json: {
                data: data,
                meta: {
                  count: data.length,
                  open_count: open_by_account.length,
                  settled_count: settled_only_by_account.length,
                  totals: projection.summary(open_rows)
                }
              }
            end

            # Records that a debt reminder was just shared or copied.
            def remind
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              result = Spree::Pos::Credit::Remind.call(store: current_store, staff: current_user, key: key, branch_id: params[:branch_id],
                                                       account_id: params[:id], via: params[:via])
              render json: { data: result }
            end

            # Sets or clears the customer's promised payment date ("Ngày hẹn trả").
            def promised_pay_on
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              account = Spree::Pos::CreditAccount.locate(Spree::Pos::CreditAccount.for_store(current_store), params[:id])
              raise ActiveRecord::RecordNotFound if account.nil?

              raw_date = params[:promised_pay_on].to_s.strip.presence
              parsed_date = raw_date ? Date.iso8601(raw_date) : nil

              payload = { 'command' => 'credit.promised_pay_on', 'branch_id' => branch.prefixed_id,
                          'credit_account_id' => account.prefixed_id, 'promised_pay_on' => parsed_date&.iso8601 }
              authorize = lambda do
                raise CanCan::AccessDenied if branch.disabled? || UNMASKED.none? { |cap| policy.allows?(branch, cap) }
              end
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload,
                                                        authorize: authorize) do
                account.lock!
                account.update_columns(promised_pay_on: parsed_date)
                audit!('credit.promised_pay_on', account, { branch_id: branch.prefixed_id, promised_pay_on: parsed_date&.iso8601 })
                { 'credit_account_id' => account.prefixed_id, 'promised_pay_on' => account.promised_pay_on&.iso8601 }
              end
              render json: { data: result }
            rescue Date::Error
              raise Spree::Pos::Conflict, 'Ngày hẹn thanh toán không hợp lệ.'
            end

            # Chronological running-balance ledger of one debtor at this branch.
            def ledger
              return if channel_rejected?

              branch = readable_branch!
              account = Spree::Pos::CreditAccount.locate(Spree::Pos::CreditAccount.for_store(current_store), params[:id])
              raise ActiveRecord::RecordNotFound if account.nil?

              entries = Spree::Pos::ReceivableEntry.for_store(current_store).
                        where(branch_id: branch.id, credit_account_id: account.id).
                        includes(:order, :actor).order(created_at: :asc, id: :asc).to_a

              running = BigDecimal('0')
              totals = Hash.new { |h, k| h[k] = BigDecimal('0') }
              rows = entries.map do |entry|
                amt = BigDecimal(entry.amount.to_s)
                signed = Spree::Pos::ReceivableEntry::RAISING.include?(entry.kind) ? amt : -amt
                running += signed
                totals[entry.kind] += amt
                {
                  id: entry.prefixed_id,
                  kind: entry.kind,
                  amount: amt.to_s('F'),
                  signed_amount: signed.to_s('F'),
                  balance_after: running.to_s('F'),
                  currency: entry.currency,
                  order_id: entry.order&.prefixed_id,
                  order_number: entry.order&.number,
                  due_on: entry.due_on&.iso8601,
                  actor_name: entry.actor&.email,
                  created_at: entry.created_at&.iso8601
                }
              end

              render json: {
                data: rows.reverse,
                meta: {
                  count: rows.length,
                  currency: account.currency,
                  total_debited: (totals['debit'] + totals['collection_reversal']).to_s('F'),
                  total_credit_notes: totals['credit_note'].to_s('F'),
                  total_collected: totals['collection'].to_s('F'),
                  current_balance: running.to_s('F')
                }
              }
            end

            private

            # The reminder's one QR carries the note of the oldest-due order
            # with the whole balance as the amount: the bank webhook
            # (Collections::ReceiveTransfer) books the coded order first and
            # spends the rest on the customer's other debts oldest due first,
            # so one transfer settles every listed order in that order.
            def customer_row(account, rows, context)
              projection = context[:projection]
              ordered = rows.sort_by { |row| [row.due_on || Date.new(9999), row.order_id] }
              summary = projection.summary(rows)
              placed = ordered.filter_map { |row| context[:orders].fetch(row.order_id).completed_at }.min
              profile = account.customer_profile
              customer = Spree::Pos::ReceivableProjection.customer(profile, context[:mask])
              summary.merge(
                'credit_account_id' => account.prefixed_id, 'currency' => account.currency,
                'customer' => customer.merge(address: context[:mask] ? nil : profile.address.presence),
                'orders' => rows.length, 'credit_limit' => account.credit_limit.to_s('F'), 'account_status' => account.status,
                'oldest_due_on' => ordered.first.due_on&.iso8601, 'oldest_placed_at' => placed&.iso8601,
                'days_owed' => placed ? [(projection.today - placed.in_time_zone(context[:branch].timezone).to_date).to_i, 0].max : 0,
                'days_overdue' => ordered.map { |row| projection.days_overdue(row) }.max,
                'last_reminded_at' => account.last_reminded_at&.iso8601,
                'promised_pay_on' => account.promised_pay_on&.iso8601,
                'last_activity_at' => context[:last_entries]&.[](account.id)&.iso8601,
                'settled' => false,
                'open_orders' => ordered.first(REMINDER_ORDERS).map { |row| reminder_order(row, context[:orders]) },
                'pay_later' => Spree::Pos::PayLater.details(order: context[:orders].fetch(ordered.first.order_id),
                                                            amount: summary['balance'], account: context[:receiving])
              )
            end

            def settled_customer_row(account, rows, context)
              profile = account.customer_profile
              customer = Spree::Pos::ReceivableProjection.customer(profile, context[:mask])
              zero = '0.0'
              {
                'balance' => zero, 'overdue' => zero, 'current' => zero, 'days_1_30' => zero,
                'days_31_60' => zero, 'days_61_90' => zero, 'days_over_90' => zero,
                'credit_account_id' => account.prefixed_id, 'currency' => account.currency,
                'customer' => customer.merge(address: context[:mask] ? nil : profile.address.presence),
                'orders' => rows.length, 'credit_limit' => account.credit_limit.to_s('F'), 'account_status' => account.status,
                'oldest_due_on' => nil, 'oldest_placed_at' => nil, 'days_owed' => 0, 'days_overdue' => 0,
                'last_reminded_at' => account.last_reminded_at&.iso8601,
                'promised_pay_on' => nil,
                'last_activity_at' => context[:last_entries]&.[](account.id)&.iso8601,
                'settled' => true,
                'open_orders' => [], 'pay_later' => nil
              }
            end

            def reminder_order(row, orders)
              order = orders.fetch(row.order_id)
              { 'order_id' => order.prefixed_id, 'order_number' => order.number, 'placed_at' => order.completed_at&.iso8601,
                'due_on' => row.due_on&.iso8601, 'balance' => BigDecimal(row.balance.to_s).to_s('F') }
            end

            def readable_branch!
              branch = branch!(params[:branch_id])
              raise CanCan::AccessDenied unless policy.membership_for(branch)&.status == 'active'

              branch
            end

            def status_param
              status = params[:status].presence || 'open'
              raise Spree::Pos::Conflict, 'Status filter is invalid.' unless STATUSES.include?(status)

              status
            end

            # The branch list holds debts sold at this branch. Looking up one
            # customer (to collect a debt here) spans every branch of the store,
            # for staff who sell, collect or approve credit at this branch.
            def projection_for(branch)
              scope = Spree::Pos::ReceivableEntry.for_store(current_store)
              if params[:customer_id].present? && action_name == 'index' && customer_lookup?(branch)
                profile = Spree::Pos::CustomerProfile.locate(Spree::Pos::CustomerProfile.for_store(current_store), params[:customer_id])
                scope = scope.where(credit_account_id: Spree::Pos::CreditAccount.where(customer_profile_id: profile&.id || 0).select(:id))
              else
                scope = scope.where(branch_id: branch.id)
                if params[:customer_id].present?
                  profile = Spree::Pos::CustomerProfile.locate(Spree::Pos::CustomerProfile.for_store(current_store), params[:customer_id])
                  scope = scope.where(credit_account_id: Spree::Pos::CreditAccount.where(customer_profile_id: profile&.id || 0).select(:id))
                end
              end
              if params[:q].present?
                accounts = Spree::Pos::CreditAccount.where(customer_profile_id: matching_profiles(branch)).select(:id)
                scope = scope.where(credit_account_id: accounts)
              end
              Spree::Pos::ReceivableProjection.new(scope, today: Time.now.in_time_zone(branch.timezone).to_date)
            end

            def customer_lookup?(branch)
              CreditAccountsController::LOOKUP_CAPABILITIES.any? { |capability| policy.allows?(branch, capability) }
            end

            # A reader who only sees masked phones may search by name or by the
            # full phone number, never by a fragment that would reveal digits.
            def matching_profiles(branch)
              query = params[:q].to_s.strip.first(120)
              profiles = Spree::Pos::CustomerProfile.for_store(current_store)
              term = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
              phone = Spree::Pos::CustomerProfile.normalize_phone(query)
              if mask?(branch)
                profiles.where('name ILIKE :term OR (normalized_phone = :phone AND :phone <> \'\')', term: term, phone: phone).select(:id)
              else
                profiles.where('name ILIKE :term OR phone ILIKE :term OR normalized_phone = :phone', term: term, phone: phone).select(:id)
              end
            end

            def page_rows(relation)
              page = [params[:page].to_i, 1].max
              limit = params[:limit].to_i
              limit = 25 if limit <= 0
              limit = PAGE_MAX if limit > PAGE_MAX
              total = Spree::Pos::ReceivableEntry.from(relation.reorder(nil), :rows).count
              records = relation.offset((page - 1) * limit).limit(limit).to_a
              pages = total.zero? ? 0 : (total.to_f / limit).ceil
              [records, { page: page, limit: limit, count: total, pages: pages }]
            end

            # Each open debt carries its pay-later QR for what is still owed,
            # for staff to send the customer (nil without VietQR at the branch).
            def serialize(projection, rows, mask, branch)
              orders = Spree::Order.where(id: rows.map(&:order_id)).index_by(&:id)
              accounts = Spree::Pos::CreditAccount.where(id: rows.map(&:credit_account_id)).includes(:customer_profile).index_by(&:id)
              workspaces = Spree::Pos::Workspace.where(id: rows.map(&:workspace_id)).index_by(&:id)
              sale_receipts = Spree::Pos::FundsAllocation.where(order_id: orders.keys, status: 'active', collection_id: nil).
                              group(:order_id).sum(:amount)
              refunds = Spree::Refund.joins(:payment).
                        where(payment_id: Spree::Pos::FundsAllocation.where(order_id: orders.keys).where.not(collection_id: nil).select(:payment_id)).
                        group('spree_payments.order_id').sum(:amount)
              lookups = { orders: orders, accounts: accounts, workspaces: workspaces, sale_receipts: sale_receipts, refunds: refunds }
              account = Spree::Pos::PayLater.receiving_account(current_store, branch)
              rows.map do |row|
                pay_later = Spree::Pos::PayLater.details(order: orders.fetch(row.order_id), amount: row.balance, account: account)
                projection.serialize(row, lookups, mask: mask).merge(pay_later: pay_later)
              end
            end

            def mask?(branch)
              UNMASKED.none? { |capability| policy.allows?(branch, capability) }
            end
          end
        end
      end
    end
  end
end
