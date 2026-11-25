# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Analytical reports modeled after full-featured retail/F&B dashboards:
          # overview, profit (P&L + breakdowns), inventory analytics, inventory XNT
          # summary (opening + inflow - outflow = closing), and income/expense transactions.
          class ReportAnalyticsController < BaseController
            scoped_resource :pos_orders
            pos_permissions overview: %w[read_pos_orders read_pos_shifts write_pos_shifts],
                            profit: %w[read_pos_orders read_pos_shifts write_pos_shifts],
                            inventory: %w[read_pos_orders read_pos_shifts write_pos_shifts read_pos_topology write_pos_topology],
                            inventory_summary: %w[read_pos_orders read_pos_shifts write_pos_shifts read_pos_topology write_pos_topology],
                            transaction: %w[read_pos_orders read_pos_shifts write_pos_shifts]

            def overview
              branch = branch!(params[:branch_id])
              from_date, to_date = parse_date_range(branch)
              prev_from, prev_to = previous_period(from_date, to_date)

              cur = build_sales_metrics(branch, from_date, to_date)
              prev = build_sales_metrics(branch, prev_from, prev_to)

              scope = Spree::Pos::Reports::Scope.new(store: current_store, staff: current_user, branch: branch)
              sales_report = Spree::Pos::Reports.build('sales', scope: scope, values: { 'from' => from_date.iso8601, 'to' => to_date.iso8601 })

              render json: {
                data: {
                  period: { from: from_date.iso8601, to: to_date.iso8601, prev_from: prev_from.iso8601, prev_to: prev_to.iso8601 },
                  currency: current_store.default_currency || 'VND',
                  kpis: {
                    gross_sales: metric_with_change(cur[:gross_sales], prev[:gross_sales]),
                    net_sales: metric_with_change(cur[:net_sales], prev[:net_sales]),
                    avg_order_value: metric_with_change(cur[:avg_order_value], prev[:avg_order_value]),
                    customers_count: count_with_change(cur[:customers_count], prev[:customers_count]),
                    orders_count: count_with_change(cur[:orders_count], prev[:orders_count]),
                    gross_profit: metric_with_change(cur[:gross_profit], prev[:gross_profit]),
                    cost_of_goods: cur[:cogs].to_s('F'),
                    returns_total: cur[:returns_total].to_s('F'),
                    discount_total: cur[:discount_total].to_s('F'),
                    tax_total: cur[:tax_total].to_s('F'),
                    item_total: cur[:item_total].to_s('F')
                  },
                  trend: sales_report.by_day,
                  by_source: sales_report.by_source,
                  top_products: sales_report.top_items(limit: 5),
                  top_customers: top_customers_for(branch, from_date, to_date, limit: 5),
                  top_staff: top_staff_for(branch, from_date, to_date, limit: 5)
                }
              }
            end

            def profit
              branch = branch!(params[:branch_id])
              from_date, to_date = parse_date_range(branch)
              prev_from, prev_to = previous_period(from_date, to_date)
              group_by = %w[day order product customer staff].include?(params[:group_by]) ? params[:group_by] : 'day'

              cur = build_sales_metrics(branch, from_date, to_date)
              prev = build_sales_metrics(branch, prev_from, prev_to)

              cur_vouchers = voucher_totals(branch, from_date, to_date)
              prev_vouchers = voucher_totals(branch, prev_from, prev_to)

              other_income = cur_vouchers[:income]
              other_expense = cur_vouchers[:expense]
              total_revenue = cur[:net_sales] + other_income
              total_expense = cur[:cogs] + other_expense
              other_profit = other_income - other_expense
              net_profit = cur[:gross_profit] + other_profit

              prev_other_profit = prev_vouchers[:income] - prev_vouchers[:expense]
              prev_net_profit = prev[:gross_profit] + prev_other_profit

              gross_margin = cur[:net_sales].positive? ? ((cur[:gross_profit] / cur[:net_sales]) * 100).round(1) : BigDecimal('0')

              render json: {
                data: {
                  period: { from: from_date.iso8601, to: to_date.iso8601, prev_from: prev_from.iso8601, prev_to: prev_to.iso8601 },
                  currency: current_store.default_currency || 'VND',
                  pnl: {
                    item_total: cur[:item_total].to_s('F'),
                    discount_total: cur[:discount_total].to_s('F'),
                    returns_total: cur[:returns_total].to_s('F'),
                    tax_total: cur[:tax_total].to_s('F'),
                    gross_sales: cur[:gross_sales].to_s('F'),
                    net_sales: cur[:net_sales].to_s('F'),
                    other_income: other_income.to_s('F'),
                    total_revenue: total_revenue.to_s('F'),
                    cogs: cur[:cogs].to_s('F'),
                    other_expense: other_expense.to_s('F'),
                    total_expense: total_expense.to_s('F'),
                    gross_profit: cur[:gross_profit].to_s('F'),
                    gross_margin_rate: gross_margin.to_f,
                    other_profit: other_profit.to_s('F'),
                    net_profit: net_profit.to_s('F'),
                    net_profit_change_pct: pct_change(net_profit, prev_net_profit)
                  },
                  trend: profit_trend_by_day(branch, from_date, to_date),
                  group_by: group_by,
                  breakdown: profit_breakdown(branch, from_date, to_date, group_by)
                }
              }
            end

            def inventory
              branch = branch!(params[:branch_id])
              from_date, to_date = parse_date_range(branch)
              prev_from, prev_to = previous_period(from_date, to_date)

              variants = Spree::Variant.joins(:product)
                                       .where(spree_products: { store_id: current_store.id, deleted_at: nil })
                                       .includes(product: :categories)
                                       .to_a
              levels = Spree::StockLevel.where(stock_location_id: branch.stock_location_id, variant_id: variants.map(&:id))
                                        .index_by(&:variant_id)
              alerts = Spree::Pos::StockAlert.where(branch_id: branch.id, variant_id: variants.map(&:id))
                                             .pluck(:variant_id, :min_quantity).to_h

              total_qty = 0
              total_value = BigDecimal('0')
              active_count = 0
              inactive_count = 0
              low_count = 0
              out_count = 0
              product_values = []
              category_totals = Hash.new { |h, k| h[k] = { name: k, quantity: 0, value: BigDecimal('0') } }

              variants.each do |variant|
                qty = levels[variant.id]&.count_on_hand || 0
                cost = (variant.cost_price || BigDecimal('0')).to_d
                val = cost * qty
                min_qty = alerts[variant.id]

                total_qty += qty
                total_value += val
                if variant.product.status == 'active'
                  active_count += 1
                else
                  inactive_count += 1
                end
                if qty <= 0
                  out_count += 1
                elsif min_qty && qty < min_qty
                  low_count += 1
                end

                product_values << {
                  variant_id: variant.prefixed_id,
                  sku: variant.sku.presence,
                  name: variant.product.name,
                  quantity: qty,
                  unit_cost: cost.to_s('F'),
                  stock_value: val.to_s('F')
                }

                cat_name = variant.product.categories.first&.name || 'Chưa phân loại'
                category_totals[cat_name][:quantity] += qty
                category_totals[cat_name][:value] += val
              end

              cur_flow = stock_document_flow(branch, from_date, to_date)
              prev_flow = stock_document_flow(branch, prev_from, prev_to)

              top_products = product_values.sort_by { |r| -BigDecimal(r[:stock_value]) }.first(5)
              top_categories = category_totals.values
                                              .sort_by { |r| -r[:value] }
                                              .first(5)
                                              .map { |r| { name: r[:name], quantity: r[:quantity], stock_value: r[:value].to_s('F') } }

              render json: {
                data: {
                  period: { from: from_date.iso8601, to: to_date.iso8601, prev_from: prev_from.iso8601, prev_to: prev_to.iso8601 },
                  currency: current_store.default_currency || 'VND',
                  stock: {
                    total_value: total_value.to_s('F'),
                    total_quantity: total_qty,
                    active_products: active_count,
                    inactive_products: inactive_count,
                    low_stock_count: low_count,
                    out_of_stock_count: out_count
                  },
                  flow: {
                    import_value: metric_with_change(cur_flow[:import_value], prev_flow[:import_value]),
                    import_count: cur_flow[:import_count],
                    export_value: metric_with_change(cur_flow[:export_value], prev_flow[:export_value]),
                    export_count: cur_flow[:export_count]
                  },
                  top_products: top_products,
                  top_categories: top_categories,
                  trend: stock_flow_trend(branch, from_date, to_date)
                }
              }
            end

            def inventory_summary
              branch = branch!(params[:branch_id])
              from_date, to_date = parse_date_range(branch, default_days: 30)
              from_time = from_date.beginning_of_day
              to_time = to_date.end_of_day

              variants = Spree::Variant.joins(:product)
                                       .where(spree_products: { store_id: current_store.id, deleted_at: nil })
                                       .includes(:product, :option_values)
                                       .order('spree_products.name ASC, spree_variants.id ASC')
                                       .to_a

              levels = Spree::StockLevel.where(stock_location_id: branch.stock_location_id, variant_id: variants.map(&:id))
                                        .index_by(&:variant_id)
              level_to_variant = levels.each_with_object({}) { |(vid, lvl), h| h[lvl.id] = vid }
              level_ids = level_to_variant.keys

              opening_qty_map = Hash.new(0)
              opening_val_map = Hash.new { |h, k| h[k] = BigDecimal('0') }
              inflow_qty_map = Hash.new(0)
              inflow_val_map = Hash.new { |h, k| h[k] = BigDecimal('0') }
              outflow_qty_map = Hash.new(0)
              outflow_val_map = Hash.new { |h, k| h[k] = BigDecimal('0') }

              variant_cost = variants.to_h { |v| [v.id, (v.cost_price || BigDecimal('0')).to_d] }

              if level_ids.any?
                Spree::StockMovement.where(stock_level_id: level_ids).where('created_at < ?', from_time).find_each do |mv|
                  vid = level_to_variant[mv.stock_level_id]
                  next unless vid

                  cost = (mv.unit_cost || variant_cost[vid] || BigDecimal('0')).to_d
                  opening_qty_map[vid] += mv.quantity
                  opening_val_map[vid] += cost * mv.quantity
                end

                Spree::StockMovement.where(stock_level_id: level_ids).where(created_at: from_time..to_time).find_each do |mv|
                  vid = level_to_variant[mv.stock_level_id]
                  next unless vid

                  cost = (mv.unit_cost || variant_cost[vid] || BigDecimal('0')).to_d
                  if mv.quantity.positive?
                    inflow_qty_map[vid] += mv.quantity
                    inflow_val_map[vid] += cost * mv.quantity
                  elsif mv.quantity.negative?
                    abs_q = mv.quantity.abs
                    outflow_qty_map[vid] += abs_q
                    outflow_val_map[vid] += cost * abs_q
                  end
                end
              end

              ingredient_ids = Spree::Pos::RecipeIngredient.joins(:recipe)
                                                           .where(spree_pos_recipes: { store_id: current_store.id })
                                                           .distinct.pluck(:ingredient_variant_id).to_set

              rows = variants.map do |variant|
                vid = variant.id
                o_qty = opening_qty_map[vid]
                o_val = opening_val_map[vid]
                i_qty = inflow_qty_map[vid]
                i_val = inflow_val_map[vid]
                x_qty = outflow_qty_map[vid]
                x_val = outflow_val_map[vid]
                c_qty = o_qty + i_qty - x_qty
                c_val = o_val + i_val - x_val

                meta = variant.product&.metadata
                is_ing = ingredient_ids.include?(vid) || (meta.is_a?(Hash) && meta['pos_kind'] == 'ingredient')

                {
                  variant_id: variant.prefixed_id,
                  sku: variant.sku.presence,
                  name: variant.product.name,
                  options_text: variant.options_text.presence,
                  base_unit: Spree::Pos::StockIntegration.base_unit_code(variant),
                  item_kind: is_ing ? 'ingredient' : 'product',
                  status: variant.product.status,
                  opening_qty: o_qty,
                  opening_value: o_val.to_s('F'),
                  inflow_qty: i_qty,
                  inflow_value: i_val.to_s('F'),
                  outflow_qty: x_qty,
                  outflow_value: x_val.to_s('F'),
                  closing_qty: c_qty,
                  closing_value: c_val.to_s('F')
                }
              end

              if params[:status].present? && params[:status] != 'all'
                rows = rows.select { |r| r[:status] == params[:status] }
              end
              if params[:item_kind].present? && params[:item_kind] != 'all'
                rows = rows.select { |r| r[:item_kind] == params[:item_kind] }
              end
              if params[:q].present?
                q = params[:q].to_s.strip.downcase
                rows = rows.select { |r| [r[:name], r[:sku], r[:options_text]].compact.any? { |s| s.downcase.include?(q) } }
              end

              totals = {
                opening_qty: rows.sum { |r| r[:opening_qty] },
                opening_value: rows.sum(BigDecimal('0')) { |r| BigDecimal(r[:opening_value]) }.to_s('F'),
                inflow_qty: rows.sum { |r| r[:inflow_qty] },
                inflow_value: rows.sum(BigDecimal('0')) { |r| BigDecimal(r[:inflow_value]) }.to_s('F'),
                outflow_qty: rows.sum { |r| r[:outflow_qty] },
                outflow_value: rows.sum(BigDecimal('0')) { |r| BigDecimal(r[:outflow_value]) }.to_s('F'),
                closing_qty: rows.sum { |r| r[:closing_qty] },
                closing_value: rows.sum(BigDecimal('0')) { |r| BigDecimal(r[:closing_value]) }.to_s('F')
              }

              render json: {
                data: rows,
                meta: {
                  period: { from: from_date.iso8601, to: to_date.iso8601 },
                  currency: current_store.default_currency || 'VND',
                  total: rows.size,
                  totals: totals
                }
              }
            end

            def transaction
              branch = branch!(params[:branch_id])
              from_date, to_date = parse_date_range(branch)
              prev_from, prev_to = previous_period(from_date, to_date)
              days_count = [(to_date - from_date).to_i + 1, 1].max

              cur_scope = Spree::Pos::FundVoucher.for_store(current_store).completed
                                                 .where(branch_id: branch.id, occurred_at: from_date.beginning_of_day..to_date.end_of_day)
              prev_scope = Spree::Pos::FundVoucher.for_store(current_store).completed
                                                  .where(branch_id: branch.id, occurred_at: prev_from.beginning_of_day..prev_to.end_of_day)

              cur_income = BigDecimal(cur_scope.where(kind: 'income').sum(:amount).to_s)
              cur_expense = BigDecimal(cur_scope.where(kind: 'expense').sum(:amount).to_s)
              cur_diff = cur_income - cur_expense

              prev_income = BigDecimal(prev_scope.where(kind: 'income').sum(:amount).to_s)
              prev_expense = BigDecimal(prev_scope.where(kind: 'expense').sum(:amount).to_s)
              prev_diff = prev_income - prev_expense

              income_by_cat = cur_scope.where(kind: 'income').group(:category_code).sum(:amount).map do |code, amt|
                { category_code: code, amount: BigDecimal(amt.to_s).to_s('F'), count: cur_scope.where(kind: 'income', category_code: code).count }
              end.sort_by { |r| -BigDecimal(r[:amount]) }

              expense_by_cat = cur_scope.where(kind: 'expense').group(:category_code).sum(:amount).map do |code, amt|
                { category_code: code, amount: BigDecimal(amt.to_s).to_s('F'), count: cur_scope.where(kind: 'expense', category_code: code).count }
              end.sort_by { |r| -BigDecimal(r[:amount]) }

              accounts = Spree::Pos::FundAccount.ensure_default!(store: current_store, branch: branch, actor: current_user)
                                                .active.order(:is_default => :desc, :name => :asc)
              inc_by_acc = cur_scope.where(kind: 'income').group(:fund_account_id).sum(:amount)
              exp_by_acc = cur_scope.where(kind: 'expense').group(:fund_account_id).sum(:amount)

              by_account = accounts.map do |acc|
                bal = acc.balance_summary
                {
                  id: acc.prefixed_id,
                  name: acc.name,
                  kind: acc.kind,
                  bank_name: acc.bank_name.presence,
                  account_number: acc.account_number.presence,
                  period_income: BigDecimal((inc_by_acc[acc.id] || 0).to_s).to_s('F'),
                  period_expense: BigDecimal((exp_by_acc[acc.id] || 0).to_s).to_s('F'),
                  current_balance: bal[:current_balance].to_s('F')
                }
              end

              day_income = cur_scope.where(kind: 'income').group('DATE(occurred_at)').sum(:amount)
              day_expense = cur_scope.where(kind: 'expense').group('DATE(occurred_at)').sum(:amount)
              trend = (from_date..to_date).map do |date|
                inc = BigDecimal((day_income[date] || day_income[date.iso8601] || 0).to_s)
                exp = BigDecimal((day_expense[date] || day_expense[date.iso8601] || 0).to_s)
                { date: date.iso8601, income: inc.to_s('F'), expense: exp.to_s('F'), net: (inc - exp).to_s('F') }
              end

              render json: {
                data: {
                  period: { from: from_date.iso8601, to: to_date.iso8601, prev_from: prev_from.iso8601, prev_to: prev_to.iso8601 },
                  currency: current_store.default_currency || 'VND',
                  summary: {
                    total_income: metric_with_change(cur_income, prev_income),
                    total_expense: metric_with_change(cur_expense, prev_expense),
                    net_diff: metric_with_change(cur_diff, prev_diff),
                    avg_income_per_day: (cur_income / days_count).round(0).to_d.to_s('F'),
                    avg_expense_per_day: (cur_expense / days_count).round(0).to_d.to_s('F')
                  },
                  trend: trend,
                  income_by_category: income_by_cat,
                  expense_by_category: expense_by_cat,
                  by_account: by_account
                }
              }
            end

            private

            def parse_date_range(branch, default_days: 7)
              tz = ActiveSupport::TimeZone[branch.timezone] || Time.zone
              today = tz.today
              from = params[:from].present? ? Date.parse(params[:from].to_s) : (today - (default_days - 1).days)
              to = params[:to].present? ? Date.parse(params[:to].to_s) : today
              from, to = to, from if from > to
              [from, to]
            rescue ArgumentError
              [today - (default_days - 1).days, today]
            end

            def previous_period(from_date, to_date)
              span = (to_date - from_date).to_i + 1
              [from_date - span.days, from_date - 1.day]
            end

            def completed_orders_scope(branch, from_date, to_date)
              workspaces = Spree::Pos::Workspace.where(branch_id: branch.id, business_date: from_date..to_date)
              Spree::Order.complete.where(id: workspaces.select(:order_id))
            end

            def build_sales_metrics(branch, from_date, to_date)
              orders = completed_orders_scope(branch, from_date, to_date)
              orders_count = orders.count
              gross_sales = BigDecimal(orders.sum(:total).to_s)
              item_total = BigDecimal(orders.sum(:item_total).to_s)
              adjustment_total = BigDecimal(orders.sum(:adjustment_total).to_s)
              tax_total = BigDecimal(orders.sum(:additional_tax_total).to_s) + BigDecimal(orders.sum(:included_tax_total).to_s)
              discount_total = adjustment_total.negative? ? adjustment_total.abs : BigDecimal('0')

              returns_total = BigDecimal(
                Spree::Pos::ReturnOperation.where(branch_id: branch.id, status: 'received')
                                           .where(received_at: from_date.beginning_of_day..to_date.end_of_day)
                                           .sum(:entitlement_total).to_s
              )
              net_sales = gross_sales - returns_total

              cogs = calculate_cogs(orders)
              gross_profit = net_sales - cogs
              avg_order = orders_count.positive? ? (gross_sales / orders_count).round(0).to_d : BigDecimal('0')

              scope = Spree::Pos::Reports::Scope.new(store: current_store, staff: current_user, branch: branch)
              sales_rep = Spree::Pos::Reports.build('sales', scope: scope, values: { 'from' => from_date.iso8601, 'to' => to_date.iso8601 })

              {
                orders_count: orders_count,
                customers_count: sales_rep.customers,
                gross_sales: gross_sales,
                item_total: item_total,
                discount_total: discount_total,
                tax_total: tax_total,
                returns_total: returns_total,
                net_sales: net_sales,
                cogs: cogs,
                gross_profit: gross_profit,
                avg_order_value: avg_order
              }
            end

            def calculate_cogs(orders)
              order_ids = orders.select(:id)
              rows = Spree::Pos::SaleLine.where(order_id: order_ids)
                                         .joins(:variant)
                                         .pluck(:base_quantity, 'spree_variants.cost_price')
              rows.sum(BigDecimal('0')) { |(qty, cost)| BigDecimal((qty || 0).to_s) * BigDecimal((cost || 0).to_s) }
            end

            def voucher_totals(branch, from_date, to_date)
              scope = Spree::Pos::FundVoucher.for_store(current_store).completed
                                             .where(branch_id: branch.id, occurred_at: from_date.beginning_of_day..to_date.end_of_day)
              {
                income: BigDecimal(scope.where(kind: 'income').sum(:amount).to_s),
                expense: BigDecimal(scope.where(kind: 'expense').sum(:amount).to_s)
              }
            end

            def top_customers_for(branch, from_date, to_date, limit: 5)
              workspaces = Spree::Pos::Workspace.where(branch_id: branch.id, business_date: from_date..to_date)
                                                .where.not(pos_customer_id: nil)
              rows = Spree::Order.complete
                                 .joins('INNER JOIN spree_pos_workspaces ON spree_pos_workspaces.order_id = spree_orders.id')
                                 .joins('INNER JOIN spree_pos_customers ON spree_pos_customers.id = spree_pos_workspaces.pos_customer_id')
                                 .where(spree_pos_workspaces: { id: workspaces.select(:id) })
                                 .group('spree_pos_customers.id', 'spree_pos_customers.name', 'spree_pos_customers.phone')
                                 .order(Arel.sql('SUM(spree_orders.total) DESC'))
                                 .limit(limit)
                                 .pluck('spree_pos_customers.id', 'spree_pos_customers.name', 'spree_pos_customers.phone',
                                        Arel.sql('COUNT(spree_orders.id)'), Arel.sql('SUM(spree_orders.total)'))
              rows.map do |(_id, name, phone, count, total)|
                { name: name, phone: phone, orders: count.to_i, revenue: BigDecimal(total.to_s).to_s('F') }
              end
            end

            def top_staff_for(branch, from_date, to_date, limit: 5)
              workspaces = Spree::Pos::Workspace.where(branch_id: branch.id, business_date: from_date..to_date)
              rows = Spree::Order.complete
                                 .joins('INNER JOIN spree_pos_workspaces ON spree_pos_workspaces.order_id = spree_orders.id')
                                 .joins('INNER JOIN spree_pos_shifts ON spree_pos_shifts.id = spree_pos_workspaces.shift_id')
                                 .where(spree_pos_workspaces: { id: workspaces.select(:id) })
                                 .group('spree_pos_shifts.owner_id')
                                 .order(Arel.sql('SUM(spree_orders.total) DESC'))
                                 .limit(limit)
                                 .pluck('spree_pos_shifts.owner_id', Arel.sql('COUNT(spree_orders.id)'), Arel.sql('SUM(spree_orders.total)'))

              staff_ids = rows.map(&:first).compact
              staff_map = Spree.admin_user_class.where(id: staff_ids).index_by(&:id)
              rows.map do |(owner_id, count, total)|
                staff = staff_map[owner_id]
                {
                  name: staff ? Spree::Pos::StaffName.call(staff) : '—',
                  orders: count.to_i,
                  revenue: BigDecimal(total.to_s).to_s('F')
                }
              end
            end

            def profit_trend_by_day(branch, from_date, to_date)
              workspaces = Spree::Pos::Workspace.where(branch_id: branch.id, business_date: from_date..to_date)
              orders = Spree::Order.complete
                                   .joins('INNER JOIN spree_pos_workspaces ON spree_pos_workspaces.order_id = spree_orders.id')
                                   .where(spree_pos_workspaces: { id: workspaces.select(:id) })
              day_sales = orders.group('spree_pos_workspaces.business_date').sum('spree_orders.total')
              day_cogs = Spree::Pos::SaleLine.joins(:workspace, :variant, :order)
                                             .where(spree_pos_workspaces: { branch_id: branch.id, business_date: from_date..to_date })
                                             .where.not(spree_orders: { completed_at: nil })
                                             .group('spree_pos_workspaces.business_date')
                                             .sum(Arel.sql('spree_pos_sale_lines.base_quantity * COALESCE(spree_variants.cost_price, 0)'))
              (from_date..to_date).map do |date|
                rev = BigDecimal((day_sales[date] || 0).to_s)
                cogs = BigDecimal((day_cogs[date] || 0).to_s)
                { date: date.iso8601, net_sales: rev.to_s('F'), cogs: cogs.to_s('F'), gross_profit: (rev - cogs).to_s('F') }
              end
            end

            def profit_breakdown(branch, from_date, to_date, group_by)
              workspaces = Spree::Pos::Workspace.where(branch_id: branch.id, business_date: from_date..to_date)
              orders = Spree::Order.complete
                                   .joins('INNER JOIN spree_pos_workspaces ON spree_pos_workspaces.order_id = spree_orders.id')
                                   .where(spree_pos_workspaces: { id: workspaces.select(:id) })

              case group_by
              when 'day'
                counts = orders.group('spree_pos_workspaces.business_date').count
                totals = orders.group('spree_pos_workspaces.business_date').sum('spree_orders.total')
                cogs_map = Spree::Pos::SaleLine.joins(:workspace, :variant, :order)
                                               .where(spree_pos_workspaces: { branch_id: branch.id, business_date: from_date..to_date })
                                               .where.not(spree_orders: { completed_at: nil })
                                               .group('spree_pos_workspaces.business_date')
                                               .sum(Arel.sql('spree_pos_sale_lines.base_quantity * COALESCE(spree_variants.cost_price, 0)'))
                (from_date..to_date).reverse_each.map do |date|
                  rev = BigDecimal((totals[date] || 0).to_s)
                  cogs = BigDecimal((cogs_map[date] || 0).to_s)
                  gp = rev - cogs
                  { label: date.iso8601, count: counts[date] || 0, gross_sales: rev.to_s('F'), net_sales: rev.to_s('F'),
                    cogs: cogs.to_s('F'), gross_profit: gp.to_s('F'), margin_rate: rev.positive? ? ((gp / rev) * 100).round(1).to_f : 0.0 }
                end
              when 'order'
                list = orders.order('spree_orders.completed_at DESC').limit(50).to_a
                cogs_map = Spree::Pos::SaleLine.where(order_id: list.map(&:id)).joins(:variant)
                                               .group(:order_id)
                                               .sum(Arel.sql('spree_pos_sale_lines.base_quantity * COALESCE(spree_variants.cost_price, 0)'))
                list.map do |ord|
                  rev = BigDecimal(ord.total.to_s)
                  cogs = BigDecimal((cogs_map[ord.id] || 0).to_s)
                  gp = rev - cogs
                  { label: ord.number, secondary: ord.completed_at&.iso8601, count: 1, gross_sales: rev.to_s('F'),
                    net_sales: rev.to_s('F'), cogs: cogs.to_s('F'), gross_profit: gp.to_s('F'),
                    margin_rate: rev.positive? ? ((gp / rev) * 100).round(1).to_f : 0.0 }
                end
              when 'product'
                rows = Spree::Pos::SaleLine.where(order_id: orders.select('spree_orders.id'))
                                           .joins(:variant, :line_item)
                                           .group('spree_pos_sale_lines.variant_id')
                                           .pluck('spree_pos_sale_lines.variant_id',
                                                  Arel.sql('SUM(spree_pos_sale_lines.base_quantity)'),
                                                  Arel.sql('SUM(spree_line_items.price * spree_line_items.quantity)'),
                                                  Arel.sql('SUM(spree_pos_sale_lines.base_quantity * COALESCE(spree_variants.cost_price, 0))'))
                variants = Spree::Variant.with_deleted.includes(:product).where(id: rows.map(&:first)).index_by(&:id)
                rows.map do |(vid, qty, rev_raw, cogs_raw)|
                  v = variants[vid]
                  rev = BigDecimal((rev_raw || 0).to_s)
                  cogs = BigDecimal((cogs_raw || 0).to_s)
                  gp = rev - cogs
                  { label: v&.product&.name || v&.sku || '—', secondary: v&.sku, count: qty.to_i,
                    gross_sales: rev.to_s('F'), net_sales: rev.to_s('F'), cogs: cogs.to_s('F'),
                    gross_profit: gp.to_s('F'), margin_rate: rev.positive? ? ((gp / rev) * 100).round(1).to_f : 0.0 }
                end.sort_by { |r| -BigDecimal(r[:gross_profit]) }.first(50)
              when 'customer'
                top_customers_for(branch, from_date, to_date, limit: 50).map do |c|
                  rev = BigDecimal(c[:revenue])
                  { label: c[:name], secondary: c[:phone], count: c[:orders], gross_sales: rev.to_s('F'),
                    net_sales: rev.to_s('F'), cogs: '0', gross_profit: rev.to_s('F'), margin_rate: 100.0 }
                end
              when 'staff'
                top_staff_for(branch, from_date, to_date, limit: 50).map do |s|
                  rev = BigDecimal(s[:revenue])
                  { label: s[:name], count: s[:orders], gross_sales: rev.to_s('F'), net_sales: rev.to_s('F'),
                    cogs: '0', gross_profit: rev.to_s('F'), margin_rate: 100.0 }
                end
              else
                []
              end
            end

            def stock_document_flow(branch, from_date, to_date)
              docs = Spree::Pos::StockDocument.for_store(current_store)
                                              .where(branch_id: branch.id, status: 'completed')
                                              .where(completed_at: from_date.beginning_of_day..to_date.end_of_day)
              imports = docs.where(kind: 'import')
              exports = docs.where(kind: 'export')
              {
                import_value: BigDecimal(imports.sum(:total_amount).to_s),
                import_count: imports.count,
                export_value: BigDecimal(exports.sum(:total_amount).to_s),
                export_count: exports.count
              }
            end

            def stock_flow_trend(branch, from_date, to_date)
              docs = Spree::Pos::StockDocument.for_store(current_store)
                                              .where(branch_id: branch.id, status: 'completed')
                                              .where(completed_at: from_date.beginning_of_day..to_date.end_of_day)
              imp_by_day = docs.where(kind: 'import').group('DATE(completed_at)').sum(:total_amount)
              exp_by_day = docs.where(kind: 'export').group('DATE(completed_at)').sum(:total_amount)
              (from_date..to_date).map do |date|
                imp = BigDecimal((imp_by_day[date] || imp_by_day[date.iso8601] || 0).to_s)
                exp = BigDecimal((exp_by_day[date] || exp_by_day[date.iso8601] || 0).to_s)
                { date: date.iso8601, import_value: imp.to_s('F'), export_value: exp.to_s('F') }
              end
            end

            def metric_with_change(current, previous)
              { value: current.to_s('F'), previous: previous.to_s('F'), change_pct: pct_change(current, previous) }
            end

            def count_with_change(current, previous)
              { value: current.to_i, previous: previous.to_i, change_pct: pct_change(BigDecimal(current.to_s), BigDecimal(previous.to_s)) }
            end

            def pct_change(current, previous)
              return nil if previous.zero? && current.zero?
              return 100.0 if previous.zero?

              (((current - previous) / previous.abs) * 100).round(1).to_f
            end
          end
        end
      end
    end
  end
end
