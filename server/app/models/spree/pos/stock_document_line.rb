# frozen_string_literal: true

module Spree
  module Pos
    # Line item of a POS stock document (import, export, count, or opening balance).
    class StockDocumentLine < Record
      self.table_name = 'spree_pos_stock_document_lines'
      has_prefix_id :posstline

      ITEM_KINDS = %w[product ingredient].freeze

      belongs_to :stock_document, class_name: 'Spree::Pos::StockDocument'
      belongs_to :variant, -> { with_deleted }, class_name: 'Spree::Variant'

      validates :item_kind, inclusion: { in: ITEM_KINDS }
      validates :unit_cost, numericality: { greater_than_or_equal_to: 0 }

      def to_pos
        {
          id: prefixed_id,
          variant_id: variant.prefixed_id,
          sku: variant.sku.presence,
          name: variant.product&.name || variant.sku,
          options_text: variant.options_text.presence,
          base_unit: StockIntegration.base_unit_code(variant),
          item_kind: item_kind,
          quantity: quantity,
          system_quantity: system_quantity,
          actual_quantity: actual_quantity,
          unit_cost: unit_cost.to_s('F'),
          line_total: line_total.to_s('F'),
          note: note.presence
        }
      end
    end
  end
end
