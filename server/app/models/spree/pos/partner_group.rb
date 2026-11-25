# frozen_string_literal: true

module Spree
  module Pos
    # Grouping for POS customers or suppliers (e.g., VIP, Wholesale, Beverage Suppliers).
    class PartnerGroup < Record
      self.table_name = 'spree_pos_partner_groups'
      has_prefix_id :pospgroup

      KINDS = %w[customer supplier].freeze

      belongs_to :store, class_name: 'Spree::Store'
      has_many :customer_profiles, class_name: 'Spree::Pos::CustomerProfile', dependent: :nullify
      has_many :suppliers, class_name: 'Spree::Pos::Supplier', dependent: :nullify

      validates :kind, inclusion: { in: KINDS }
      validates :name, presence: true, length: { maximum: 120 }, uniqueness: { scope: %i[store_id kind] }

      scope :for_store, ->(store) { where(store_id: store.id) }
      scope :of_kind, ->(kind) { where(kind: kind) }

      before_validation { self.name = name.to_s.strip.presence }

      def to_pos(members_count: nil, total_receivable: nil, total_payable: nil)
        {
          id: prefixed_id,
          kind: kind,
          name: name,
          note: note.presence,
          members_count: members_count,
          total_receivable: total_receivable&.to_s('F'),
          total_payable: total_payable&.to_s('F'),
          created_at: created_at&.iso8601
        }.compact
      end
    end
  end
end
