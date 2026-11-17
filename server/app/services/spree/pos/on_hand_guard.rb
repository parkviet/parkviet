# frozen_string_literal: true

module Spree
  module Pos
    # Refuses a counter sale that would take more than the branch shelf shows,
    # when the branch has turned `allow_oversell` off. The shelf itself never
    # goes negative: a shortfall that still gets through (two completions at
    # once, or an offline sale) is recorded by handover as it is today.
    #
    # Not applied to serial/lot goods (they have their own check), menu items
    # (sold-out and recipes), delivery-platform orders, or a location that
    # keeps no stock level for the variant.
    module OnHandGuard
      REASON = 'stock_insufficient'
      PLATFORM_SOURCES = %w[grabfood shopeefood].freeze

      module_function

      def ensure!(workspace, variant, needed, kind: nil)
        return if skip?(workspace, variant, kind)

        level = Spree::StockLevel.find_by(stock_location_id: workspace.branch.stock_location_id, variant_id: variant.id)
        return if level.nil? || level.count_on_hand >= needed

        raise Conflict.new('Not enough stock at this branch.', reason: REASON,
                           details: { variant_id: variant.prefixed_id, needed: needed, on_hand: level.count_on_hand })
      end

      # `added` is the extra base quantity this change puts on the order.
      def ensure_added!(workspace, variant, added, kind: nil)
        return if added <= 0

        ensure!(workspace, variant, held(workspace, variant) + added, kind: kind)
      end

      # The whole order, checked again at completion because another counter
      # may have sold the last units since the lines were added.
      def ensure_order!(workspace)
        return if SalesSettings.for(workspace.branch)['allow_oversell']
        return if PLATFORM_SOURCES.include?(workspace.order_source)

        lines_of(workspace).includes(:variant).reject { |line| skip?(workspace, line.variant, line.kind) }.group_by(&:variant_id).each_value do |lines|
          line = lines.first
          next if line.nil?

          level = Spree::StockLevel.find_by(stock_location_id: workspace.branch.stock_location_id, variant_id: line.variant_id)
          needed = lines.sum(&:base_quantity)
          next if level.nil? || level.count_on_hand >= needed

          raise Conflict.new('Not enough stock at this branch.', reason: REASON,
                             details: { variant_id: line.variant.prefixed_id, needed: needed, on_hand: level.count_on_hand })
        end
      end

      def held(workspace, variant)
        lines_of(workspace).where(variant_id: variant.id).sum(:base_quantity)
      end

      def lines_of(workspace)
        SaleLine.where(workspace_id: workspace.id)
      end

      def skip?(workspace, variant, kind)
        return true if SalesSettings.for(workspace.branch)['allow_oversell']
        return true if PLATFORM_SOURCES.include?(workspace.order_source)
        return true if kind == SaleLineKinds::Menu::KIND
        return true if StockIntegration.tracked_mode(workspace.store_id, variant) != 'none'
        return true unless variant.track_inventory?

        false
      end
    end
  end
end