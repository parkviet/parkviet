# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          class FundAccountsController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders],
                            create: %w[write_pos_orders],
                            update: %w[write_pos_orders],
                            transfer: %w[write_pos_orders]

            def index
              return if channel_rejected?

              branch = readable_branch!
              accounts = Spree::Pos::FundAccount.ensure_default!(store: current_store, branch: branch, actor: current_user).
                         includes(:branch).order(is_default: :desc, id: :asc).to_a

              inflows, outflows = aggregate_flows(accounts)
              serialized = accounts.map { |account| account.to_pos(inflows: inflows, outflows: outflows) }
              total_balance = serialized.sum { |row| BigDecimal(row[:current_balance]) }

              render json: {
                data: serialized,
                meta: { count: serialized.length, total_balance: total_balance.to_s('F'), currency: current_store.default_currency || 'VND' }
              }
            end

            def create
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              name = params[:name].to_s.strip
              kind = params[:kind].to_s.presence || 'cash'
              opening = parse_opening_balance(params[:opening_balance])

              payload = { 'command' => 'fund_account.create', 'branch_id' => branch.prefixed_id, 'name' => name, 'kind' => kind,
                          'opening_balance' => opening.to_s('F') }
              authorize = -> { authorize_write!(branch) }
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload,
                                                        authorize: authorize) do
                raise Spree::Pos::Conflict, 'Tên nguồn tiền không được để trống.' if name.blank?
                raise Spree::Pos::Conflict, 'Loại nguồn tiền không hợp lệ.' unless Spree::Pos::FundAccount::KINDS.include?(kind)

                account = Spree::Pos::FundAccount.create!(
                  store: current_store, branch: branch, name: name, kind: kind,
                  bank_name: params[:bank_name].to_s.strip.presence,
                  account_number: params[:account_number].to_s.strip.presence,
                  currency: current_store.default_currency || 'VND',
                  opening_balance: opening, status: 'active',
                  created_by: current_user, updated_by: current_user
                )
                audit!('fund_account.create', account, { branch_id: branch.prefixed_id, kind: kind, opening_balance: opening.to_s('F') })
                account.to_pos
              rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
                raise Spree::Pos::Conflict, e.message
              end
              render json: { data: result }, status: :created
            end

            def update
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              account = account!(params[:id])
              branch = account.branch
              updates = {}
              updates[:name] = params[:name].to_s.strip if params.key?(:name)
              updates[:bank_name] = params[:bank_name].to_s.strip.presence if params.key?(:bank_name)
              updates[:account_number] = params[:account_number].to_s.strip.presence if params.key?(:account_number)
              updates[:opening_balance] = parse_opening_balance(params[:opening_balance]) if params.key?(:opening_balance)
              updates[:status] = params[:status].to_s if params.key?(:status)

              payload = { 'command' => 'fund_account.update', 'account_id' => account.prefixed_id }.merge(updates.transform_keys(&:to_s).transform_values(&:to_s))
              authorize = -> { authorize_write!(branch) }
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload,
                                                        authorize: authorize) do
                account.lock!
                account.assign_attributes(updates.merge(updated_by: current_user))
                account.save!
                audit!('fund_account.update', account, updates.transform_values(&:to_s))
                account.to_pos
              rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
                raise Spree::Pos::Conflict, e.message
              end
              render json: { data: result }
            end

            def transfer
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              from_account = account!(params[:from_account_id], branch: branch)
              to_account = account!(params[:to_account_id], branch: branch)
              amount = parse_positive_amount!(params[:amount])
              occurred_at = parse_occurred_at(params[:occurred_at])

              payload = { 'command' => 'fund_account.transfer', 'branch_id' => branch.prefixed_id,
                          'from_account_id' => from_account.prefixed_id, 'to_account_id' => to_account.prefixed_id,
                          'amount' => amount.to_s('F') }
              authorize = -> { authorize_write!(branch) }
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload,
                                                        authorize: authorize) do
                raise Spree::Pos::Conflict, 'Nguồn tiền gửi và nhận phải khác nhau.' if from_account.id == to_account.id

                voucher = Spree::Pos::FundVoucher.create!(
                  store: current_store, branch: branch, fund_account: from_account, target_fund_account: to_account,
                  code: Spree::Pos::FundVoucher.next_code(current_store, 'transfer'),
                  kind: 'transfer', status: 'completed', amount: amount,
                  currency: current_store.default_currency || 'VND',
                  category_code: Spree::Pos::FundVoucher::TRANSFER_CATEGORY,
                  tax_deductible: false,
                  reference: params[:reference].to_s.strip.presence,
                  note: params[:note].to_s.strip.presence,
                  occurred_at: occurred_at, actor: current_user
                )
                audit!('fund_account.transfer', voucher, { from: from_account.prefixed_id, to: to_account.prefixed_id, amount: amount.to_s('F') })
                voucher.to_pos
              rescue ActiveRecord::RecordInvalid => e
                raise Spree::Pos::Conflict, e.message
              end
              render json: { data: result }, status: :created
            end

            private

            def readable_branch!
              branch = branch!(params[:branch_id])
              allowed = policy.allows?(branch, Spree::Pos::Capabilities::PAYMENT) ||
                        policy.allows?(branch, Spree::Pos::Capabilities::RESOLVE) ||
                        policy.permission?('write_pos_topology')
              raise CanCan::AccessDenied unless allowed

              branch
            end

            def authorize_write!(branch)
              allowed = policy.allows?(branch, Spree::Pos::Capabilities::RESOLVE) ||
                        policy.permission?('write_pos_topology')
              raise CanCan::AccessDenied if branch.disabled? || !allowed
            end

            def account!(prefixed, branch: nil)
              scope = Spree::Pos::FundAccount.for_store(current_store)
              scope = scope.where(branch_id: branch.id) if branch
              account = Spree::Pos::FundAccount.locate(scope, prefixed)
              raise ActiveRecord::RecordNotFound if account.nil?

              account
            end

            def aggregate_flows(accounts)
              ids = accounts.map(&:id)
              return [{}, {}] if ids.empty?

              base = Spree::Pos::FundVoucher.for_store(current_store).completed
              income_by_acc = base.where(kind: 'income', fund_account_id: ids).group(:fund_account_id).sum(:amount)
              transfer_in_by_acc = base.where(kind: 'transfer', target_fund_account_id: ids).group(:target_fund_account_id).sum(:amount)
              out_by_acc = base.where(kind: %w[expense transfer], fund_account_id: ids).group(:fund_account_id).sum(:amount)

              inflows = Hash.new { |h, k| h[k] = BigDecimal('0') }
              income_by_acc.each { |id, amt| inflows[id] += BigDecimal(amt.to_s) }
              transfer_in_by_acc.each { |id, amt| inflows[id] += BigDecimal(amt.to_s) }
              outflows = out_by_acc.transform_values { |amt| BigDecimal(amt.to_s) }
              [inflows, outflows]
            end

            def parse_opening_balance(raw)
              return BigDecimal('0') if raw.blank?

              str = raw.to_s.strip
              raise Spree::Pos::Conflict, 'Số dư đầu kỳ không hợp lệ.' unless str.match?(/\A-?\d+(\.\d{1,2})?\z/)

              BigDecimal(str)
            end

            def parse_positive_amount!(raw)
              parsed = Spree::Pos::Record.money(raw)
              currency = current_store.default_currency || 'VND'
              raise Spree::Pos::Conflict, 'Số tiền không hợp lệ.' if parsed.nil? || parsed <= 0
              raise Spree::Pos::Conflict, 'Số tiền phải là số nguyên theo đơn vị tiền tệ.' unless Spree::Pos::Record.countable_money?(parsed, currency)

              parsed
            end

            def parse_occurred_at(raw)
              return Time.current if raw.blank?

              Time.zone.parse(raw.to_s) || Time.current
            rescue ArgumentError
              raise Spree::Pos::Conflict, 'Thời gian giao dịch không hợp lệ.'
            end
          end
        end
      end
    end
  end
end
