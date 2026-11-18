# frozen_string_literal: true

module Spree
  module Pos
    # A sample order under a tax regime that is not saved yet: one item and
    # one delivery, taxed as a real order would be. Writes nothing.
    #
    # Direct: the customer pays the listed amounts and nothing is printed;
    # the preview shows the tax the lines would owe in a year over the
    # threshold (VAT on all of it, income tax at the option's rate when it is
    # computed on revenue). Deduction: each line's VAT as Spree computes it,
    # backed out of the price or added on top.
    module TaxPreview
      ITEM_AMOUNT = BigDecimal('100000')
      SHIPPING_AMOUNT = BigDecimal('20000')

      module_function

      def call(store, draft)
        regime = TaxRegimes::Save.build(store, draft, previous: TaxRegimes::Save.baseline(store))
        regime.validate!
        on = DirectTax.today
        lines = [{ kind: 'item', rate_key: regime.item_option, revenue_amount: ITEM_AMOUNT },
                 { kind: 'shipping', rate_key: regime.shipping_option, revenue_amount: SHIPPING_AMOUNT }]
        rows = if !regime.enabled then lines.map { |line| untaxed(line, on) }
               elsif regime.direct? then direct(store, regime, lines, on)
               else deduction(store, regime, lines, on)
               end
        {
          enabled: regime.enabled, method: regime.tax_method, prices_include_tax: regime.prices_include_tax, lines: rows,
          customer_total: money(rows.sum { |row| BigDecimal(row[:customer_amount]) }),
          vat_total: money(rows.sum { |row| BigDecimal(row[:vat_amount] || '0') }),
          pit_total: money(rows.sum { |row| BigDecimal(row[:pit_amount] || '0') }),
          revenue_year: DirectTax.year_summary(store, regime: regime)
        }
      end

      # Tax as if the year were already over the threshold.
      def direct(store, regime, lines, on)
        ytd = VnTaxCatalog.threshold(on: on)[:amount]
        DirectTax.estimate(store, lines, ytd: ytd, regime: regime, on: on).map do |line|
          base(line, on).merge(customer_amount: money(line[:revenue_amount]), vat_rate: line[:vat_rate]&.to_s('F'),
                               vat_amount: money(line[:vat_amount]), pit_rate: line[:pit_rate]&.to_s('F'),
                               pit_amount: money(line[:pit_amount]), printed: false)
        end
      end

      # Spree's internal provider: half up per line to the currency, the
      # rate backed out of an inclusive price.
      def deduction(store, regime, lines, on)
        currency = store.default_currency
        lines.map do |line|
          option = VnTaxCatalog.option(line[:rate_key])
          amount = line[:revenue_amount]
          next untaxed(line, on) unless option[:kind] == 'rate'

          rate = VnTaxCatalog.deduction_rate(option, on: on)
          raw = regime.prices_include_tax ? amount / (1 + rate) * rate : amount * rate
          tax = Spree::Money::Rounding.to_currency(raw, currency)
          base(line, on).merge(customer_amount: money(regime.prices_include_tax ? amount : amount + tax),
                               vat_rate: rate.to_s('F'), vat_amount: money(tax), pit_rate: nil, pit_amount: nil, printed: true)
        end
      end

      def untaxed(line, on)
        base(line, on).merge(customer_amount: money(line[:revenue_amount]), vat_rate: nil, vat_amount: nil, pit_rate: nil,
                             pit_amount: nil, printed: false)
      end

      def base(line, on)
        { kind: line[:kind], option: line[:rate_key], label: TaxOptions.label(VnTaxCatalog.option(line[:rate_key]), on: on),
          amount: money(line[:revenue_amount]) }
      end

      def money(value)
        BigDecimal(value.to_s).to_s('F')
      end
    end
  end
end
