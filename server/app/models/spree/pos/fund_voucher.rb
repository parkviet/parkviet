# frozen_string_literal: true

module Spree
  module Pos
    # Back-office income/expense voucher or internal fund transfer, mapped to
    # statutory TT152/2025/TT-BTC categories with a tax-deductibility flag.
    class FundVoucher < Record
      self.table_name = 'spree_pos_fund_vouchers'
      has_prefix_id :posvouch

      KINDS = %w[income expense transfer].freeze
      STATUSES = %w[completed voided].freeze

      INCOME_CATEGORIES = %w[
        debt_collection
        sales_other
        capital_contribution
        loan_interest
        supplier_refund
        other_income
      ].freeze

      EXPENSE_CATEGORIES = %w[
        purchase_goods
        debt_payment
        labor_cost
        electricity
        water
        telecom
        rent
        management
        social_insurance
        health_insurance
        unemployment_insurance
        vat_tax
        pit_tax
        shipping
        asset_rent
        maintenance
        interest_expense
        depreciation
        other_expense
      ].freeze

      TRANSFER_CATEGORY = 'internal_transfer'
      ALL_CATEGORIES = (INCOME_CATEGORIES + EXPENSE_CATEGORIES + [TRANSFER_CATEGORY]).freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :fund_account, class_name: 'Spree::Pos::FundAccount'
      belongs_to :target_fund_account, class_name: 'Spree::Pos::FundAccount', optional: true
      belongs_to :customer_profile, class_name: 'Spree::Pos::CustomerProfile', optional: true
      belongs_to :actor, class_name: staff_class_name
      belongs_to :voided_by, class_name: staff_class_name, optional: true

      validates :code, presence: true, length: { maximum: 32 }, uniqueness: { scope: :store_id }
      validates :kind, inclusion: { in: KINDS }
      validates :status, inclusion: { in: STATUSES }
      validates :amount, numericality: { greater_than: 0 }
      validates :currency, presence: true
      validates :category_code, inclusion: { in: ALL_CATEGORIES }
      validates :category_label, length: { maximum: 120 }, allow_blank: true
      validates :counterparty_name, length: { maximum: 120 }, allow_blank: true
      validates :reference, length: { maximum: 120 }, allow_blank: true
      validates :occurred_at, presence: true
      validate :accounts_match_branch
      validate :transfer_has_distinct_target

      scope :for_store, ->(store) { where(store_id: store.id) }
      scope :completed, -> { where(status: 'completed') }

      def self.next_code(store, kind)
        prefix = case kind.to_s
                 when 'income' then 'PT'
                 when 'expense' then 'PC'
                 else 'CK'
                 end
        last = for_store(store).where('code LIKE ?', "#{prefix}%").order(id: :desc).pick(:code)
        seq = last ? last.delete_prefix(prefix).to_i + 1 : 1
        format('%s%05d', prefix, seq)
      end

      def to_pos
        {
          id: prefixed_id, code: code, kind: kind, status: status,
          branch_id: branch.prefixed_id,
          fund_account_id: fund_account.prefixed_id,
          fund_account_name: fund_account.name,
          fund_account_kind: fund_account.kind,
          target_fund_account_id: target_fund_account&.prefixed_id,
          target_fund_account_name: target_fund_account&.name,
          amount: amount.to_s('F'), currency: currency,
          category_code: category_code, category_label: category_label.presence,
          tax_deductible: tax_deductible,
          counterparty_name: counterparty_name.presence || customer_profile&.name,
          customer_id: customer_profile&.prefixed_id,
          reference: reference.presence, note: note.presence,
          occurred_at: occurred_at&.iso8601,
          actor_name: actor&.email,
          voided_at: voided_at&.iso8601, void_reason: void_reason.presence,
          created_at: created_at&.iso8601
        }
      end

      private

      def accounts_match_branch
        errors.add(:fund_account, :invalid) if fund_account && (fund_account.store_id != store_id || fund_account.branch_id != branch_id)
        if target_fund_account && (target_fund_account.store_id != store_id || target_fund_account.branch_id != branch_id)
          errors.add(:target_fund_account, :invalid)
        end
        errors.add(:customer_profile, :invalid) if customer_profile && customer_profile.store_id != store_id
      end

      def transfer_has_distinct_target
        return unless kind == 'transfer'

        if target_fund_account_id.blank?
          errors.add(:target_fund_account, :blank)
        elsif target_fund_account_id == fund_account_id
          errors.add(:target_fund_account, :invalid)
        end
      end
    end
  end
end
