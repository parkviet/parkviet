# frozen_string_literal: true

module Spree
  module Pos
    # Payment made by the store to a supplier (optionally linked to a specific import document).
    class SupplierPayment < Record
      self.table_name = 'spree_pos_supplier_payments'
      has_prefix_id :possuppay

      METHODS = %w[cash bank ewallet].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :supplier, class_name: 'Spree::Pos::Supplier'
      belongs_to :stock_document, class_name: 'Spree::Pos::StockDocument', optional: true
      belongs_to :actor, class_name: staff_class_name

      validates :amount, numericality: { greater_than: 0 }
      validates :payment_method, inclusion: { in: METHODS }
      validates :occurred_at, presence: true

      scope :for_store, ->(store) { where(store_id: store.id) }

      def to_pos
        {
          id: prefixed_id,
          supplier_id: supplier.prefixed_id,
          branch_id: branch.prefixed_id,
          stock_document_id: stock_document&.prefixed_id,
          stock_document_code: stock_document&.code,
          amount: amount.to_s('F'),
          payment_method: payment_method,
          occurred_at: occurred_at&.iso8601,
          actor_name: actor&.email,
          note: note.presence,
          created_at: created_at&.iso8601
        }
      end
    end
  end
end
