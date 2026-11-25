# frozen_string_literal: true

module Spree
  module Pos
    # A cash drawer/safe, bank account, or e-wallet tracked per branch for
    # opening balances, back-office income/expense vouchers, and internal fund
    # transfers. Separate from payment gateway configuration.
    class FundAccount < Record
      self.table_name = 'spree_pos_fund_accounts'
      has_prefix_id :posfundacc

      KINDS = %w[cash bank ewallet].freeze
      STATUSES = %w[active archived].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :created_by, class_name: staff_class_name
      belongs_to :updated_by, class_name: staff_class_name
      has_many :vouchers, class_name: 'Spree::Pos::FundVoucher', foreign_key: :fund_account_id,
                          dependent: :restrict_with_error
      has_many :incoming_transfers, class_name: 'Spree::Pos::FundVoucher', foreign_key: :target_fund_account_id,
                                    dependent: :restrict_with_error

      validates :name, presence: true, length: { maximum: 120 }, uniqueness: { scope: :branch_id }
      validates :kind, inclusion: { in: KINDS }
      validates :status, inclusion: { in: STATUSES }
      validates :currency, presence: true
      validates :opening_balance, numericality: true
      validates :bank_name, length: { maximum: 120 }, allow_blank: true
      validates :account_number, length: { maximum: 64 }, allow_blank: true
      validate :branch_in_store

      scope :for_store, ->(store) { where(store_id: store.id) }
      scope :active, -> { where(status: 'active') }

      # Ensures each branch has a default cash fund account so users can record
      # vouchers immediately without manual setup.
      def self.ensure_default!(store:, branch:, actor:)
        existing = for_store(store).where(branch_id: branch.id)
        return existing if existing.exists?

        create!(
          store: store, branch: branch, name: 'Tiền mặt', kind: 'cash',
          currency: store.default_currency || 'VND', opening_balance: 0,
          status: 'active', is_default: true, created_by: actor, updated_by: actor
        )
        for_store(store).where(branch_id: branch.id)
      rescue ActiveRecord::RecordNotUnique
        for_store(store).where(branch_id: branch.id)
      end

      def balance_summary(inflows: nil, outflows: nil)
        inflow = if inflows
                   BigDecimal(inflows.fetch(id, 0).to_s)
                 else
                   BigDecimal(vouchers.completed.where(kind: 'income').sum(:amount).to_s) +
                     BigDecimal(incoming_transfers.completed.where(kind: 'transfer').sum(:amount).to_s)
                 end
        outflow = if outflows
                    BigDecimal(outflows.fetch(id, 0).to_s)
                  else
                    BigDecimal(vouchers.completed.where(kind: %w[expense transfer]).sum(:amount).to_s)
                  end
        current = BigDecimal(opening_balance.to_s) + inflow - outflow
        { inflow: inflow, outflow: outflow, current_balance: current }
      end

      def to_pos(inflows: nil, outflows: nil)
        bal = balance_summary(inflows: inflows, outflows: outflows)
        {
          id: prefixed_id, branch_id: branch.prefixed_id, name: name, kind: kind,
          bank_name: bank_name.presence, account_number: account_number.presence,
          currency: currency, opening_balance: opening_balance.to_s('F'),
          inflow: bal[:inflow].to_s('F'), outflow: bal[:outflow].to_s('F'),
          current_balance: bal[:current_balance].to_s('F'),
          status: status, is_default: is_default,
          updated_at: updated_at&.iso8601
        }
      end

      private

      def branch_in_store
        errors.add(:branch, :invalid) if branch && branch.store_id != store_id
      end
    end
  end
end
