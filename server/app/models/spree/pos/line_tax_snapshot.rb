# frozen_string_literal: true

module Spree
  module Pos
    # The tax one line, fee or delivery of a direct-method sale owes: VAT on
    # its revenue at the option's rate, always written, and income tax on the
    # part of its revenue above the year's threshold (zero when income tax is
    # computed on income). A return writes the same row negated. Rows are
    # never rewritten; whether the year's tax is due is decided from the
    # year's revenue (TaxRevenueYear), not here.
    class LineTaxSnapshot < Record
      self.table_name = 'spree_pos_line_tax_snapshots'
      has_prefix_id :poslinetax

      KINDS = %w[item fee shipping].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :order, class_name: 'Spree::Order'
      belongs_to :line_item, class_name: 'Spree::LineItem', optional: true
      belongs_to :fee, class_name: 'Spree::Fee', optional: true
      belongs_to :fulfillment, class_name: 'Spree::Fulfillment', optional: true
      belongs_to :return_operation, class_name: 'Spree::Pos::ReturnOperation', optional: true
      belongs_to :tax_category, -> { with_deleted }, class_name: 'Spree::TaxCategory', optional: true
      belongs_to :regime, class_name: 'Spree::Pos::TaxRegime'

      validates :kind, inclusion: { in: KINDS }
      validates :rate_key, :business_date, presence: true

      scope :for_store, ->(store) { where(store_id: store.id) }
      scope :sales, -> { where(return_operation_id: nil) }
    end
  end
end
