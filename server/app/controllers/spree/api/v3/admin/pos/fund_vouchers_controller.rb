# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          class FundVouchersController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders],
                            show: %w[read_pos_orders write_pos_orders],
                            create: %w[write_pos_orders],
                            void: %w[write_pos_orders],
                            quick_qr: %w[read_pos_orders write_pos_orders]

            def index
              return if channel_rejected?

              branch = readable_branch!
              scope = filtered_scope(branch)
              summary = compute_summary(scope)
              records, meta = page_scope(scope.includes(:branch, :fund_account, :target_fund_account, :customer_profile, :actor).order(occurred_at: :desc, id: :desc))

              render json: {
                data: records.map(&:to_pos),
                meta: meta.merge(summary: summary)
              }
            end

            def show
              return if channel_rejected?

              voucher = voucher!(params[:id])
              authorize_read!(voucher.branch)
              render json: { data: voucher.to_pos }
            end

            def create
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              kind = params[:kind].to_s
              raise Spree::Pos::Conflict, 'Loại phiếu phải là thu hoặc chi.' unless %w[income expense].include?(kind)

              amount = parse_positive_amount!(params[:amount])
              account = find_account!(branch, params[:fund_account_id])
              category = params[:category_code].to_s.presence || (kind == 'income' ? 'other_income' : 'other_expense')
              occurred_at = parse_occurred_at(params[:occurred_at])
              customer = find_customer(params[:customer_id])
              tax_deductible = kind == 'expense' ? ActiveModel::Type::Boolean.new.cast(params.fetch(:tax_deductible, true)) : true

              payload = { 'command' => 'fund_voucher.create', 'branch_id' => branch.prefixed_id, 'kind' => kind,
                          'fund_account_id' => account.prefixed_id, 'amount' => amount.to_s('F'),
                          'category_code' => category }
              authorize = -> { authorize_write!(branch) }
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload,
                                                        authorize: authorize) do
                voucher = Spree::Pos::FundVoucher.create!(
                  store: current_store, branch: branch, fund_account: account,
                  code: Spree::Pos::FundVoucher.next_code(current_store, kind),
                  kind: kind, status: 'completed', amount: amount,
                  currency: current_store.default_currency || 'VND',
                  category_code: category,
                  category_label: params[:category_label].to_s.strip.presence,
                  tax_deductible: tax_deductible,
                  counterparty_name: params[:counterparty_name].to_s.strip.presence,
                  customer_profile: customer,
                  reference: params[:reference].to_s.strip.presence,
                  note: params[:note].to_s.strip.presence,
                  occurred_at: occurred_at, actor: current_user
                )
                audit!('fund_voucher.create', voucher, { kind: kind, amount: amount.to_s('F'), category_code: category })
                voucher.to_pos
              rescue ActiveRecord::RecordInvalid => e
                raise Spree::Pos::Conflict, e.message
              end
              render json: { data: result }, status: :created
            end

            def void
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              voucher = voucher!(params[:id])
              reason = params[:reason].to_s.strip
              payload = { 'command' => 'fund_voucher.void', 'voucher_id' => voucher.prefixed_id, 'reason' => reason }
              authorize = -> { authorize_write!(voucher.branch) }
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload,
                                                        authorize: authorize) do
                voucher.lock!
                raise Spree::Pos::Conflict, 'Phiếu đã bị hủy trước đó.' if voucher.status == 'voided'

                voucher.update!(status: 'voided', voided_by: current_user, voided_at: Time.current, void_reason: reason.presence)
                audit!('fund_voucher.void', voucher, { reason: reason.presence })
                voucher.to_pos
              end
              render json: { data: result }
            end

            def quick_qr
              return if channel_rejected?

              branch = readable_branch!
              account = Spree::Pos::PayLater.receiving_account(current_store, branch)
              if account.nil?
                render json: { data: { available: false, reason: 'vietqr_not_configured' } }
                return
              end

              amount = params[:amount].present? ? parse_positive_amount!(params[:amount]) : BigDecimal('0')
              whole = amount.to_i
              content = params[:reference].to_s.strip.presence || "TT CH #{SecureRandom.alphanumeric(6).upcase}"
              qr_payload = Spree::Pos::PayLater.payload(
                bank_bin: account.bank_bin, account_number: account.account_number, amount: whole, content: content
              )
              image_url = if defined?(SpreeVietqr::GenerateQr)
                            SpreeVietqr::GenerateQr.new.call_for_topup(
                              payment_method: account.payment_method, amount: whole,
                              transfer_content: content, receiving_account: account
                            )
                          end

              render json: {
                data: {
                  available: true,
                  amount: amount.to_s('F'),
                  currency: current_store.default_currency || 'VND',
                  transfer_content: content,
                  bank_bin: account.bank_bin,
                  bank_name: account.bank_name.presence || (defined?(SpreeVietqr::PaymentInfo) ? SpreeVietqr::PaymentInfo::BANK_NAMES[account.bank_bin] : nil),
                  account_number: account.account_number,
                  account_name: account.account_name,
                  payload: qr_payload,
                  image_url: image_url
                }
              }
            end

            private

            def readable_branch!
              branch = branch!(params[:branch_id])
              authorize_read!(branch)
              branch
            end

            def authorize_read!(branch)
              allowed = policy.allows?(branch, Spree::Pos::Capabilities::PAYMENT) ||
                        policy.allows?(branch, Spree::Pos::Capabilities::RESOLVE) ||
                        policy.permission?('write_pos_topology')
              raise CanCan::AccessDenied unless allowed
            end

            def authorize_write!(branch)
              allowed = policy.allows?(branch, Spree::Pos::Capabilities::RESOLVE) ||
                        policy.permission?('write_pos_topology')
              raise CanCan::AccessDenied if branch.disabled? || !allowed
            end

            def voucher!(prefixed)
              voucher = Spree::Pos::FundVoucher.locate(Spree::Pos::FundVoucher.for_store(current_store), prefixed)
              raise ActiveRecord::RecordNotFound if voucher.nil?

              voucher
            end

            def find_account!(branch, prefixed)
              accounts = Spree::Pos::FundAccount.ensure_default!(store: current_store, branch: branch, actor: current_user)
              if prefixed.present?
                account = Spree::Pos::FundAccount.locate(accounts, prefixed)
                raise ActiveRecord::RecordNotFound if account.nil?

                return account
              end
              accounts.find_by(is_default: true) || accounts.first!
            end

            def find_customer(prefixed)
              return nil if prefixed.blank?

              Spree::Pos::CustomerProfile.locate(Spree::Pos::CustomerProfile.for_store(current_store), prefixed)
            end

            def filtered_scope(branch)
              scope = Spree::Pos::FundVoucher.for_store(current_store).where(branch_id: branch.id)
              scope = scope.where(kind: params[:kind]) if Spree::Pos::FundVoucher::KINDS.include?(params[:kind].to_s)
              scope = scope.where(status: params[:status]) if Spree::Pos::FundVoucher::STATUSES.include?(params[:status].to_s)
              scope = scope.where(category_code: params[:category_code]) if params[:category_code].present?
              if params[:fund_account_id].present?
                acc = Spree::Pos::FundAccount.locate(Spree::Pos::FundAccount.for_store(current_store).where(branch_id: branch.id), params[:fund_account_id])
                scope = acc ? scope.where('fund_account_id = :id OR target_fund_account_id = :id', id: acc.id) : scope.none
              end
              tz = ActiveSupport::TimeZone[branch.timezone] || Time.zone
              if params[:from].present?
                from_date = Date.iso8601(params[:from].to_s)
                scope = scope.where('occurred_at >= ?', tz.local(from_date.year, from_date.month, from_date.day).beginning_of_day)
              end
              if params[:to].present?
                to_date = Date.iso8601(params[:to].to_s)
                scope = scope.where('occurred_at <= ?', tz.local(to_date.year, to_date.month, to_date.day).end_of_day)
              end
              if params[:search].present?
                term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:search].to_s.strip.first(120))}%"
                scope = scope.where('code ILIKE :term OR counterparty_name ILIKE :term OR reference ILIKE :term OR note ILIKE :term OR category_label ILIKE :term', term: term)
              end
              scope
            rescue Date::Error
              raise Spree::Pos::Conflict, 'Khoảng thời gian lọc không hợp lệ.'
            end

            def compute_summary(scope)
              completed = scope.completed
              income = BigDecimal(completed.where(kind: 'income').sum(:amount).to_s)
              expense = BigDecimal(completed.where(kind: 'expense').sum(:amount).to_s)
              {
                total_income: income.to_s('F'),
                total_expense: expense.to_s('F'),
                net_change: (income - expense).to_s('F'),
                count: scope.count
              }
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
