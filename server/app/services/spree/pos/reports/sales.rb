# frozen_string_literal: true

module Spree
  module Pos
    module Reports
      # Placed POS orders by sale time, and returns received at the branch by
      # return time, as two sections. Sales are not receipts: a credit sale
      # counts in full here and its debt appears under receivables. Returns
      # never reduce the sale rows; the summary shows them separately.
      class Sales < Base
        ENUMS = { 'section' => %w[sales returns], 'order_source' => Workspace::ORDER_SOURCES }.freeze
        # `sold_offline_at`: when the counter sold an order it replayed after selling offline.
        COLUMNS = %w[order_number sold_at business_date order_source register shift_id cashier item_total adjustment_total
                     total currency sold_offline_at].freeze
        RETURN_COLUMNS = %w[return_id order_number returned_at sale_branch receiver entitlement_total credit_note_amount
                            refund_entitlement currency].freeze
        # Who a sale's customer is: the account of its POS customer profile,
        # else the order's account, else the profile; NULL for a walk-in.
        CUSTOMER_KEY_SQL = "COALESCE('a' || COALESCE(spree_pos_customers.customer_id, spree_orders.customer_id)::text, " \
                           "'p' || spree_pos_workspaces.pos_customer_id::text)"
        VISITS_SQL = "COUNT(DISTINCT #{CUSTOMER_KEY_SQL}) + COUNT(*) FILTER (WHERE #{CUSTOMER_KEY_SQL} IS NULL)".freeze
        QUANTITY_SQL = 'SUM(spree_pos_sale_lines.base_quantity)'

        # Sales belong to the business date stamped on the workspace, not the
        # calendar day of completed_at. Returns stay on the time they were received.
        def self.business_dated?
          true
        end

        def returns?
          filters['section'] == 'returns'
        end

        def columns
          returns? ? RETURN_COLUMNS : COLUMNS
        end

        def relation
          returns? ? returns.order(received_at: :desc, id: :desc) : sales.order('spree_orders.completed_at DESC, spree_orders.id DESC')
        end

        def rows(records)
          returns? ? return_rows(records) : sale_rows(records)
        end

        def summary
          sales_total = sales.sum('spree_orders.total')
          returns_total = returns.sum(:entitlement_total)
          { orders: sales.count, sales_total: money(sales_total), returns: returns.count,
            returns_total: money(returns_total), net_sales: money(sales_total - returns_total),
            offline_orders: offline_sales.count, offline_total: money(offline_sales.sum('spree_orders.total')),
            by_source: by_source }
        end

        # The same sales grouped by where the order came from: orders, gross
        # sales (returns are not netted here) and what customers still owe
        # on those orders today, from the receivable ledger. Every source is
        # listed, in the fixed order, even with no sales.
        def by_source
          table = Workspace.table_name
          joined = sales.joins("INNER JOIN #{table} ON #{table}.order_id = spree_orders.id").group("#{table}.order_source")
          counts = joined.count
          totals = joined.sum('spree_orders.total')
          entries = ReceivableEntry.where(order_id: sales.select('spree_orders.id'))
          entries = entries.joins("INNER JOIN #{table} ON #{table}.id = #{ReceivableEntry.table_name}.workspace_id")
          owed = entries.group("#{table}.order_source").sum(Arel.sql(ReceivableEntry::SIGNED_SQL))
          Workspace::ORDER_SOURCES.map do |source|
            { order_source: source, orders: counts[source] || 0, sales_total: money(totals[source]),
              owed: money([BigDecimal((owed[source] || 0).to_s), 0].max) }
          end
        end

        # The same sales by the hour they completed, in the branch timezone:
        # [{ hour: 0..23, orders:, sales_total: }], only hours with sales.
        def by_hour
          hour = Arel.sql(ActiveRecord::Base.sanitize_sql_array(
                            ["EXTRACT(HOUR FROM spree_orders.completed_at AT TIME ZONE 'UTC' AT TIME ZONE ?)", zone_name]
                          ))
          sales.group(hour).order(hour).pluck(hour, Arel.sql('COUNT(*)'), Arel.sql('SUM(spree_orders.total)')).map do |at, orders, total|
            { hour: at.to_i, orders: orders.to_i, sales_total: money(total) }
          end
        end

        # The same sales by business date, every day of the range listed
        # (zeros on days without sales). Returns sit on the branch day they
        # were received, as in the summary, so the days add up to it.
        # Customers are counted per day as in #customers.
        def by_day
          return [] if filters.from.nil?

          table = Workspace.table_name
          joined = sales.joins("INNER JOIN #{table} ON #{table}.order_id = spree_orders.id").group("#{table}.business_date")
          counts = joined.count
          totals = joined.sum('spree_orders.total')
          visits = with_customers.group("#{table}.business_date").pluck(Arel.sql("#{table}.business_date"), Arel.sql(VISITS_SQL)).to_h
          day = Arel.sql(ActiveRecord::Base.sanitize_sql_array(
                           ["DATE(spree_pos_return_operations.received_at AT TIME ZONE 'UTC' AT TIME ZONE ?)", zone_name]
                         ))
          returned = returns.group(day).sum(:entitlement_total)
          (filters.from..filters.to).map do |date|
            sales_total = BigDecimal((totals[date] || 0).to_s)
            returns_total = BigDecimal((returned[date] || 0).to_s)
            { date: date.iso8601, orders: counts[date] || 0, customers: visits[date].to_i, sales_total: money(sales_total),
              returns_total: money(returns_total), net_sales: money(sales_total - returns_total) }
          end
        end

        # Customer visits of the same sales: each registered customer once
        # however many orders they placed, plus every order without a linked
        # customer as one walk-in visit. A customer is the account linked to
        # the POS customer profile, else the order's account, else the
        # profile itself.
        def customers
          with_customers.pick(Arel.sql(VISITS_SQL)).to_i
        end

        # The best sellers of the same sales, by quantity and by revenue.
        # Quantities are in stock units and revenue is the line amount of
        # MenuMargin; lines count as sold, returns never take them back.
        def top_items(limit: 5)
          lines = SaleLine.where(order_id: sales.select('spree_orders.id')).joins(:line_item).group('spree_pos_sale_lines.variant_id')
          columns = ['spree_pos_sale_lines.variant_id', Arel.sql(QUANTITY_SQL), Arel.sql(MenuMargin::REVENUE_SQL)]
          by_quantity = lines.order(Arel.sql("#{QUANTITY_SQL} DESC, spree_pos_sale_lines.variant_id")).limit(limit).pluck(*columns)
          by_revenue = lines.order(Arel.sql("#{MenuMargin::REVENUE_SQL} DESC, spree_pos_sale_lines.variant_id")).limit(limit).
                       pluck(*columns)
          ids = (by_quantity + by_revenue).map(&:first).uniq
          variants = Spree::Variant.with_deleted.includes(:product, :option_values).where(id: ids).index_by(&:id)
          units = VariantUnit.where(variant_id: ids, status: 'active').includes(:base_unit).to_h { |unit| [unit.variant_id, unit.base_unit&.code] }
          row = lambda do |(variant_id, quantity, revenue)|
            variant = variants[variant_id]
            { variant_id: variant&.prefixed_id, name: variant_label(variant), sku: variant&.sku.presence,
              base_unit: units[variant_id] || 'item', quantity: quantity.to_i, revenue: money(revenue) }
          end
          { by_quantity: by_quantity.map(&row), by_revenue: by_revenue.map(&row) }
        end

        # The ids of the orders the report counts, for counts kept elsewhere.
        def order_ids
          sales.select('spree_orders.id')
        end

        private

        # The sales joined to their workspace and its customer profile.
        def with_customers
          sales.joins('INNER JOIN spree_pos_workspaces ON spree_pos_workspaces.order_id = spree_orders.id').
            joins('LEFT JOIN spree_pos_customers ON spree_pos_customers.id = spree_pos_workspaces.pos_customer_id')
        end

        # The branch timezone IANA identifier.
        def zone_name
          ActiveSupport::TimeZone[branch.timezone]&.tzinfo&.name || 'UTC'
        end

        # The sales that were made offline and replayed later.
        def offline_sales
          sales.where(id: Workspace.where(id: OfflineSale.where(status: 'completed').select(:workspace_id)).select(:order_id))
        end

        def sales
          workspaces = Workspace.where(branch_id: branch.id).where(shift_id: scope.shifts.select(:id))
          workspaces = workspaces.where(order_source: filters['order_source']) if filters['order_source']
          workspaces = workspaces.where(register_id: filters.register.id) if filters.register
          workspaces = workspaces.where(shift_id: filters.shift.id) if filters.shift
          workspaces = workspaces.where(shift_id: Shift.where(owner_id: filters.cashier.id).select(:id)) if filters.cashier
          orders = Spree::Order.complete.where(id: workspaces.select(:order_id))
          return orders if filters.from.nil?

          orders.where(id: workspaces.where(business_date: filters.from..filters.to).select(:order_id))
        end

        def returns
          scope_rows = ReturnOperation.where(branch_id: branch.id, status: 'received')
          scope_rows = scope_rows.where(receiver_id: scope.staff.id) unless scope.full?
          scope_rows = scope_rows.where(receiver_id: filters.cashier.id) if filters.cashier
          # Returns carry no drawer or shift; those filters select the sales they came from.
          if filters.register || filters.shift || filters['order_source']
            origin = Workspace.all
            origin = origin.where(register_id: filters.register.id) if filters.register
            origin = origin.where(shift_id: filters.shift.id) if filters.shift
            origin = origin.where(order_source: filters['order_source']) if filters['order_source']
            scope_rows = scope_rows.where(workspace_id: origin.select(:id))
          end
          within_range(scope_rows, 'spree_pos_return_operations.received_at')
        end

        def sale_rows(orders)
          workspaces = Workspace.where(order_id: orders.map(&:id)).includes(:register, shift: :owner).index_by(&:order_id)
          offline = OfflineSale.where(workspace_id: workspaces.values.map(&:id), status: 'completed').pluck(:workspace_id, :client_sold_at).to_h
          orders.map do |order|
            workspace = workspaces[order.id]
            { order_number: order.number, sold_at: local(order.completed_at),
              business_date: workspace&.business_date&.iso8601, order_source: workspace&.order_source,
              register: workspace&.register&.code,
              shift_id: workspace&.shift&.prefixed_id, cashier: StaffName.call(workspace&.shift&.owner),
              item_total: money(order.item_total), adjustment_total: money(order.adjustment_total),
              total: money(order.total), currency: order.currency,
              sold_offline_at: workspace && offline[workspace.id] ? local(offline[workspace.id]) : nil }
          end
        end

        def return_rows(operations)
          ActiveRecord::Associations::Preloader.new(records: operations, associations: %i[order sale_branch receiver]).call
          operations.map do |operation|
            { return_id: operation.prefixed_id, order_number: operation.order.number,
              returned_at: local(operation.received_at), sale_branch: operation.sale_branch.code,
              receiver: StaffName.call(operation.receiver), entitlement_total: money(operation.entitlement_total),
              credit_note_amount: money(operation.credit_note_amount),
              refund_entitlement: money(operation.refund_entitlement), currency: operation.currency }
          end
        end
      end
    end
  end
end
