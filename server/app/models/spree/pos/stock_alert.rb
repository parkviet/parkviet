# frozen_string_literal: true

module Spree
  module Pos
    # A branch's low-stock threshold for a variant, in its stock unit. Going
    # below it when a recipe is consumed records `stock.low`.
    class StockAlert < Record
      self.table_name = 'spree_pos_stock_alerts'
      has_prefix_id :posstockalert

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :variant, -> { with_deleted }, class_name: 'Spree::Variant'

      validates :min_quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: (2**31) - 1 }
      validates :variant_id, uniqueness: { scope: :branch_id }

      # Whether the staff may read a branch's thresholds: topology readers,
      # inventory managers and report readers there.
      def self.readable?(policy, branch)
        return true if policy.permission?('read_pos_topology') || policy.permission?('write_pos_topology')

        [Capabilities::INVENTORY_MANAGE, Capabilities::REPORT_READ].any? { |capability| policy.allows?(branch, capability) }
      end

      # The branch's thresholds with what its shelf shows now, lowest first.
      def self.board(branch)
        rows = where(branch_id: branch.id).includes(:branch, variant: %i[product option_values]).to_a
        levels = Spree::StockLevel.where(stock_location_id: branch.stock_location_id, variant_id: rows.map(&:variant_id)).
                 pluck(:variant_id, :count_on_hand).to_h
        rows.map { |row| row.to_pos(on_hand: levels[row.variant_id] || 0) }.
          sort_by { |row| [row[:low] ? 0 : 1, row[:on_hand] - row[:min_quantity], row[:name].to_s] }
      end

      def to_pos(on_hand:)
        {
          id: prefixed_id, branch_id: branch.prefixed_id, variant_id: variant.prefixed_id, name: variant.product&.name,
          sku: variant.sku.presence, options_text: variant.options_text.presence,
          base_unit: StockIntegration.base_unit_code(variant), min_quantity: min_quantity, on_hand: on_hand,
          low: on_hand < min_quantity
        }
      end
    end
  end
end
