# frozen_string_literal: true

module Spree
  module Pos
    # Store-scoped supplier record for POS stock imports and accounts payable.
    class Supplier < Record
      self.table_name = 'spree_pos_suppliers'
      has_prefix_id :possupp

      STATUSES = %w[active inactive].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :partner_group, class_name: 'Spree::Pos::PartnerGroup', optional: true
      belongs_to :created_by, class_name: staff_class_name
      belongs_to :customer_profile, class_name: 'Spree::Pos::CustomerProfile', optional: true
      has_many :stock_documents, class_name: 'Spree::Pos::StockDocument', dependent: :nullify
      has_many :supplier_payments, class_name: 'Spree::Pos::SupplierPayment', dependent: :restrict_with_error

      before_validation :normalize_fields
      before_validation :assign_code, on: :create

      validates :code, presence: true, length: { maximum: 32 }, uniqueness: { scope: :store_id }
      validates :name, presence: true, length: { maximum: 120 }
      validates :phone, length: { maximum: 32 }, allow_blank: true
      validates :email, length: { maximum: 254 }, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
      validates :status, inclusion: { in: STATUSES }
      validates :opening_payable, numericality: true

      scope :for_store, ->(store) { where(store_id: store.id) }

      def self.next_code(store)
        last = for_store(store).where('code LIKE ?', 'NCC%').order(id: :desc).pick(:code)
        seq = last ? last.delete_prefix('NCC').to_i + 1 : 1
        format('NCC%05d', seq)
      end

      def to_pos(stats: nil)
        imported_total = stats ? stats[:imported_total] : BigDecimal('0')
        import_count = stats ? stats[:import_count] : 0
        paid_total = stats ? stats[:paid_total] : BigDecimal('0')
        payable = opening_payable + imported_total - paid_total

        {
          id: prefixed_id,
          code: code,
          name: name,
          phone: phone.presence,
          email: email.presence,
          address: address.presence,
          partner_group_id: partner_group&.prefixed_id,
          partner_group_name: partner_group&.name,
          tax_code: tax_code.presence,
          invoice_company: invoice_company.presence,
          invoice_address: invoice_address.presence,
          bank_name: bank_name.presence,
          bank_account: bank_account.presence,
          tags: Array(tags),
          status: status,
          opening_payable: opening_payable.to_s('F'),
          also_customer: also_customer,
          customer_profile_id: customer_profile&.prefixed_id,
          note: note.presence,
          import_count: import_count,
          imported_total: imported_total.to_s('F'),
          paid_total: paid_total.to_s('F'),
          payable_balance: payable.to_s('F'),
          created_at: created_at&.iso8601
        }
      end

      private

      def normalize_fields
        self.name = name.to_s.strip.presence
        self.code = code.to_s.strip.upcase.presence
        self.phone = phone.to_s.strip.presence
        self.normalized_phone = phone.present? ? CustomerProfile.normalize_phone(phone) : nil
        self.email = email.to_s.strip.downcase.presence
        self.address = address.to_s.squish.presence
        self.tax_code = tax_code.to_s.strip.presence
        self.tags = Array(tags).map { |tag| tag.to_s.strip }.reject(&:blank?).uniq.first(10)
      end

      def assign_code
        self.code ||= self.class.next_code(store) if store
      end
    end
  end
end
