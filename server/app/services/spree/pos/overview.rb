# frozen_string_literal: true

module Spree
  module Pos
    # The POS dashboard's home page in one read. Every sales figure comes
    # from Reports::Sales over the same filters, so it matches the sales
    # report; the comparison period is the run of equally many days just
    # before. The reader's scope (whole branch or own shifts) is the
    # report's. Order status counts use the order list's own status rules
    # over the period's sales; stock counts come from the branch's
    # low-stock thresholds and its lots.
    class Overview
      TOP_ITEMS = 5
      # Lots expiring within this many days count as expiring soon, as the
      # inventory screens badge them.
      NEAR_EXPIRY_DAYS = 30

      def initialize(scope:, values:, compare: false)
        @scope = scope
        @report = Reports.build('sales', scope: scope, values: values)
        @previous = previous_report if compare
      end

      attr_reader :scope, :report, :previous

      def to_h
        summary = report.summary
        filters = report.filters
        {
          branch_id: branch.prefixed_id, timezone: branch.timezone, scope: scope.full? ? 'branch' : 'own',
          from: filters.from.iso8601, to: filters.to.iso8601,
          previous_from: previous && previous.filters.from.iso8601, previous_to: previous && previous.filters.to.iso8601,
          totals: totals(report, summary), previous_totals: previous && totals(previous, previous.summary),
          by_day: report.by_day, previous_by_day: previous&.by_day,
          by_hour: report.by_hour, by_source: summary[:by_source],
          top_items: report.top_items(limit: TOP_ITEMS),
          status_counts: status_counts, stock_alerts: stock_alerts
        }
      end

      private

      def branch
        scope.branch
      end

      # The sales summary plus customer visits (Reports::Sales#customers).
      def totals(sales, summary)
        summary.except(:by_source).merge(customers: sales.customers)
      end

      def previous_report
        days = (report.filters.to - report.filters.from).to_i + 1
        to = report.filters.from - 1
        Reports.build('sales', scope: scope, values: { 'from' => (to - (days - 1)).iso8601, 'to' => to.iso8601 })
      end

      # The period's orders under each status of the order list.
      def status_counts
        history = OrderHistory.new(store: scope.store, branch: branch)
        orders = report.order_ids
        workspaces = Workspace.where(branch_id: branch.id, order_id: orders)
        OrderHistory::STATUSES.to_h do |status|
          [status, history.filter_status(workspaces, status, candidates: orders).distinct.count(:order_id)]
        end
      end

      # Counts only for readers of the stock alert page; nil for others.
      def stock_alerts
        return unless StockAlert.readable?(scope.policy, branch)

        rows = StockAlert.board(branch)
        today = StockIntegration.today(branch)
        expiring = InventoryLot.for_store(scope.store).where(stock_location_id: branch.stock_location_id, status: 'active').
                   where(on_hand: 1..).where(expiry_on: today..(today + NEAR_EXPIRY_DAYS)).count
        { out_of_stock: rows.count { |row| row[:on_hand] <= 0 },
          low_stock: rows.count { |row| row[:low] && row[:on_hand].positive? },
          expiring_soon: expiring, near_expiry_days: NEAR_EXPIRY_DAYS }
      end
    end
  end
end
