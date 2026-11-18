# frozen_string_literal: true

module Spree
  module Pos
    # Tax a direct-method store owes on its sales. The customer pays the
    # listed price and nothing is printed: a direct option has no TaxRate.
    # Each completed sale instead records, per line, fee and delivery:
    #
    #   vat_amount = revenue × the option's VAT rate on the business date
    #                (always, so crossing the threshold never recomputes a sale)
    #   pit_amount = the part of the revenue above the year's threshold
    #                × the option's income tax rate (zero when income tax is
    #                computed on income)
    #
    # rounded to the currency. Revenue is what the customer pays after
    # discounts, fees included, tips excluded (they never reach the order).
    # Every sale adds to the year's revenue, whatever the method; a return
    # writes its lines negated and takes its revenue back out. Whether the
    # year's tax is due is decided from the year's revenue: nothing at or
    # under the threshold, otherwise the whole year's VAT plus income tax.
    module DirectTax
      ZONE = 'Asia/Ho_Chi_Minh'
      FALLBACK_ROLE = { 'item' => 'item', 'fee' => 'service_fee', 'shipping' => 'shipping' }.freeze

      module_function

      def today
        Time.current.in_time_zone(ZONE).to_date
      end

      # Records a placed sale on its business date, in the caller's
      # transaction. The year row is locked first, so concurrent sales add up
      # one after the other.
      def record(order, business_date:)
        store = order.store
        regime = TaxRegime.current(store)
        year = TaxRevenueYear.lock_for!(store, business_date.year)
        if regime&.enabled && regime.direct?
          lines = estimate(store, sale_lines(order, regime), ytd: year.revenue, regime: regime, on: business_date)
          write!(store, order, regime, business_date, lines)
          revenue = lines.sum(BigDecimal('0')) { |line| line[:revenue_amount] }
        else
          revenue = BigDecimal(order.total.to_s) - order.additional_tax_total.to_d - order.included_tax_total.to_d
        end
        year.add!(revenue, on: business_date, period: declaration_period(store))
        year
      end

      # Takes a received return back out on its business date: each returned
      # line's revenue, and for a line the sale recorded, its tax at the
      # sale's rates, negated.
      def reverse(operation, rows, business_date:)
        store = operation.store
        year = TaxRevenueYear.lock_for!(store, business_date.year)
        sales = LineTaxSnapshot.sales.where(order_id: operation.order_id, line_item_id: rows.map(&:line_item_id)).index_by(&:line_item_id)
        threshold = VnTaxCatalog.threshold(on: business_date)[:amount]
        exponent = exponent(operation.currency)
        running = year.revenue
        lines = rows.filter_map do |row|
          net = BigDecimal(row.net.to_s)
          before = running
          running -= net
          sale = sales[row.line_item_id]
          next if sale.nil? || net.zero?

          base = above(running, threshold) - above(before, threshold)
          { kind: 'item', line_item_id: row.line_item_id, return_operation_id: operation.id, tax_category_id: sale.tax_category_id,
            rate_key: sale.rate_key, vat_rate: sale.vat_rate, pit_rate: sale.pit_rate, revenue_amount: -net,
            vat_amount: round(-net * (sale.vat_rate || 0), exponent), pit_base_amount: base,
            pit_amount: sale.pit_rate ? round(base * sale.pit_rate, exponent) : BigDecimal('0'), regime_id: sale.regime_id }
        end
        write!(store, operation.order, nil, business_date, lines)
        year.add!(running - year.revenue, on: business_date, period: declaration_period(store))
        year
      end

      # Tax of `lines` ({ rate_key:, revenue_amount:, ... }) sold after `ytd`
      # of the year's revenue, in order; each line comes back with its rates
      # and amounts. Writes nothing.
      def estimate(store, lines, ytd:, regime: TaxRegime.current(store), on: today)
        threshold = VnTaxCatalog.threshold(on: on)[:amount]
        exponent = exponent(store.default_currency)
        running = BigDecimal(ytd.to_s)
        lines.map do |line|
          option = VnTaxCatalog.option(line[:rate_key])
          vat_rate = VnTaxCatalog.direct_vat_rate(option, on: on, reduce: regime.apply_reduction)
          pit_rate = regime.pit_on_revenue? ? option[:pit_rate] : nil
          revenue = BigDecimal(line[:revenue_amount].to_s)
          base = above(running + revenue, threshold) - above(running, threshold)
          running += revenue
          line.merge(vat_rate: vat_rate, pit_rate: pit_rate, vat_amount: round(revenue * (vat_rate || 0), exponent),
                     pit_base_amount: base, pit_amount: pit_rate ? round(base * pit_rate, exponent) : BigDecimal('0'))
        end
      end

      # The year's revenue against the threshold and the tax it makes due.
      def year_summary(store, year = today.year, regime: TaxRegime.current(store))
        row = TaxRevenueYear.for(store, year)
        threshold = VnTaxCatalog.threshold(on: [today, Date.new(year, 12, 31)].min)
        days = Date.new(year, 1, 1)..Date.new(year, 12, 31)
        vat, pit = LineTaxSnapshot.for_store(store).where(business_date: days).
                   pick(Arel.sql('COALESCE(SUM(vat_amount), 0)'), Arel.sql('COALESCE(SUM(pit_amount), 0)'))
        due = row.revenue > threshold[:amount]
        {
          year: year, revenue: money(row.revenue), threshold: money(threshold[:amount]),
          ratio: (row.revenue / threshold[:amount]).round(4).to_s('F'), warning: warning(row, threshold, regime),
          crossed_on: row.crossed_on&.iso8601, crossed_period: row.crossed_period, einvoice_deadline: row.einvoice_deadline&.iso8601,
          tax_due: due, vat_amount: money(vat), pit_amount: money(pit), payable_amount: money(due ? vat + pit : 0)
        }
      end

      # Counts a year again from the store's completed POS sales and received
      # returns, by business date, so the crossing day is found as it was.
      def recount_year!(store, year)
        days = Date.new(year, 1, 1)..Date.new(year, 12, 31)
        sales = Workspace.where(store_id: store.id, operational_status: 'completed', business_date: days).joins(:order).
                group(:business_date).
                sum(Arel.sql('spree_orders.total - spree_orders.additional_tax_total - spree_orders.included_tax_total'))
        events = sales.to_a
        ReturnOperation.where(store_id: store.id, status: 'received', received_at: (days.first - 1).beginning_of_day..(days.last + 1).end_of_day).
          includes(:branch).find_each do |operation|
          day = BusinessDay.for(operation.branch, operation.received_at)
          events << [day, -operation.reservations.holding.sum(:net)] if days.cover?(day)
        end
        row = TaxRevenueYear.lock_for!(store, year)
        row.update!(revenue: 0, crossed_on: nil, crossed_period: nil)
        period = declaration_period(store)
        events.sort_by(&:first).each { |day, amount| row.add!(BigDecimal(amount.to_s), on: day, period: period) }
        row
      end

      # Discounts are Spree::Discount rows (negative) on a line item or a
      # delivery; an order-wide discount is already spread over the lines.
      def sale_lines(order, regime)
        discounts = Spree::Discount.where(order_id: order.id)
        by_line = discounts.where.not(line_item_id: nil).group(:line_item_id).sum(:amount)
        by_fulfillment = discounts.where.not(fulfillment_id: nil).group(:fulfillment_id).sum(:amount)
        rows = order.line_items.map do |line|
          { kind: 'item', line_item_id: line.id, tax_category_id: line.tax_category_id,
            revenue_amount: [line.amount + by_line.fetch(line.id, 0), BigDecimal('0')].max }
        end
        order.fees.each do |fee|
          rows << { kind: 'fee', fee_id: fee.id, tax_category_id: fee.tax_category_id, revenue_amount: BigDecimal(fee.amount.to_s) }
        end
        order.fulfillments.each do |fulfillment|
          rows << { kind: 'shipping', fulfillment_id: fulfillment.id, tax_category_id: fulfillment.tax_category_id,
                    revenue_amount: [fulfillment.cost.to_d + by_fulfillment.fetch(fulfillment.id, 0), BigDecimal('0')].max }
        end
        rows = rows.select { |row| row[:revenue_amount].positive? }
        keys = Spree::TaxCategory.with_deleted.where(id: rows.filter_map { |row| row[:tax_category_id] }).pluck(:id, :tax_code).to_h
        defaults = regime.option_keys
        rows.map do |row|
          key = keys[row[:tax_category_id]]
          key = defaults.fetch(FALLBACK_ROLE.fetch(row[:kind])) unless VnTaxCatalog.method_of(key) == 'direct'
          row.merge(rate_key: key)
        end
      end

      def write!(store, order, regime, business_date, lines)
        return if lines.empty?

        now = Time.current
        columns = %i[kind line_item_id fee_id fulfillment_id return_operation_id tax_category_id rate_key vat_rate pit_rate
                     revenue_amount vat_amount pit_base_amount pit_amount]
        LineTaxSnapshot.insert_all!(lines.map do |line|
          columns.index_with { |column| line[column] }.merge(
            store_id: store.id, order_id: order.id, regime_id: line[:regime_id] || regime.id, business_date: business_date, created_at: now
          )
        end)
      end

      def warning(row, threshold, regime)
        return 'crossed' if row.crossed_on
        return nil unless regime.nil? || regime.threshold_warning

        reached = threshold[:warning_ratios].select { |ratio| row.revenue >= threshold[:amount] * ratio }.max
        reached && "near_#{(reached * 100).to_i}"
      end

      def declaration_period(store)
        TaxProfile.for_store(store)&.declaration_period || 'quarter'
      end

      def above(revenue, threshold)
        [revenue - threshold, BigDecimal('0')].max
      end

      def round(value, exponent)
        value.round(exponent, BigDecimal::ROUND_HALF_UP)
      end

      def exponent(currency)
        ::Money::Currency.find(currency.to_s)&.exponent || 0
      end

      def money(value)
        BigDecimal(value.to_s).to_s('F')
      end
    end
  end
end
