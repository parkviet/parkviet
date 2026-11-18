# frozen_string_literal: true

module Spree
  module Pos
    # The store's tax options: the live TaxCategory rows whose tax_code is a
    # VnTaxCatalog option of the method in force, in catalog order. Every
    # tax picker (menu items, products, fees, rate plans) reads this list, and
    # an item keeps the picked category's id.
    module TaxOptions
      module_function

      def for(store, on: Date.current)
        regime = TaxRegime.current(store)
        method = regime&.tax_method || 'deduction'
        categories = Spree::TaxCategory.where(store_id: store.id).where.not(tax_code: nil).index_by(&:tax_code)
        defaults = regime ? regime.option_keys : {}
        VnTaxCatalog.options(method, on: on).filter_map do |option|
          category = categories[option[:code]]
          next if category.nil?

          row(option, category, on: on).merge(defaults: defaults.select { |_, key| key == option[:code] }.keys)
        end
      end

      # Every option of `method` in force on `on`, whether or not the store
      # has its category yet: what a form switching method can offer.
      def catalog(method, on: Date.current)
        VnTaxCatalog.options(method, on: on).map { |option| row(option, nil, on: on) }
      end

      def row(option, category, on: Date.current)
        direct = option[:method] == 'direct'
        {
          tax_category_id: category&.prefixed_id, option: option[:code], method: option[:method], label: label(option, on: on),
          industry: direct ? option[:industry] : nil, industry_name: direct ? option[:name] : nil,
          vat_rate: vat_rate(option, on: on)&.to_s('F'), pit_rate: direct ? option[:pit_rate].to_s('F') : nil,
          vat_exempt: direct ? option[:vat_exempt] : option[:kind] != 'rate'
        }
      end

      # "GTGT 3% – TNCN 1,5%", "GTGT không chịu thuế – TNCN 2%", "GTGT 10%".
      def label(option, on: Date.current)
        return option[:name] if option[:method] == 'deduction' && option[:kind] != 'rate'
        return "GTGT #{percent(vat_rate(option, on: on))}" if option[:method] == 'deduction'

        vat = option[:vat_exempt] ? 'GTGT không chịu thuế' : "GTGT #{percent(option[:vat_rate])}"
        "#{vat} – TNCN #{percent(option[:pit_rate])}"
      end

      def vat_rate(option, on: Date.current)
        option[:method] == 'deduction' ? VnTaxCatalog.deduction_rate(option, on: on) : option[:vat_rate]
      end

      # A fraction as a Vietnamese percentage: 0.015 is "1,5%".
      def percent(fraction)
        value = (fraction * 100).to_s('F').delete_suffix('.0')
        "#{value.tr('.', ',')}%"
      end
    end
  end
end
