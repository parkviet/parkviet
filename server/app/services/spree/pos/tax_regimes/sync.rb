# frozen_string_literal: true

module Spree
  module Pos
    module TaxRegimes
      # Makes a store's tax categories match its regime, in the caller's
      # transaction under the store lock:
      #
      # * one live TaxCategory per catalog option of the regime's method,
      #   found by tax_code, restored when retired earlier, else created;
      # * deduction options with a rate carry one Vietnam TaxRate (none while
      #   the regime is off), its future amount scheduled; direct options
      #   carry none, so Spree writes no tax lines and prices stay as listed;
      # * the goods default is the store's is_default category, and the
      #   market's prices include tax when the deduction regime says so;
      # * products, delivery methods and references follow a changed default:
      #   on a method change (or `apply_to_all_products`) every product moves
      #   to the new default, otherwise only those on the old default;
      # * the other method's categories are retired (soft-deleted), so old
      #   orders keep the category they were sold under.
      module Sync
        # The categories the F&B setup step and earlier seeds created before
        # the catalog existed, and the options they are.
        LEGACY_CODES = { 'vat_food' => 'deduction.vat_8', 'vat_special' => 'deduction.vat_10' }.freeze
        VN = 'VN'

        module_function

        # @return [Hash] reassigned_products: how many products moved
        def call(store:, regime:, previous:, apply_to_all_products: false)
          store.lock!
          categories!(store, regime.tax_method)
          default_item!(store, regime)
          rates!(store, regime)
          markets!(store, regime)
          moved = reassign_products!(store, regime, previous, apply_to_all_products)
          reassign_delivery_methods!(store, regime, previous)
          retire!(store, regime)
          { reassigned_products: moved }
        end

        # Category per option of `method` in force today, by catalog key.
        def categories!(store, method)
          VnTaxCatalog.options(method).to_h { |option| [option[:code], category!(store, option)] }
        end

        # The first regime of a store, from the categories it already has, so
        # it sells exactly as before: the legacy food and special categories
        # become their deduction options with their rates and schedules, the
        # store's default category the option matching its rate (none: not
        # taxed), and prices include tax as the default market says.
        def adopt!(store)
          ApplicationRecord.transaction do
            store.lock!
            existing = TaxRegime.current(store)
            next existing if existing

            LEGACY_CODES.each { |code, key| retag!(store, Spree::TaxCategory.find_by(store_id: store.id, tax_code: code), key) }
            item = adopted_default_key(store)
            categories = categories!(store, 'deduction')
            group = VnTaxCatalog.revenue_group('group_3')
            regime = TaxRegime.create!(
              store: store, enabled: true, tax_method: 'deduction', revenue_group: group[:code], pit_method: group[:pit_methods].first,
              pit_income_rate: group[:pit_income_rate], prices_include_tax: store_market(store)&.tax_inclusive != false,
              apply_reduction: false, threshold_warning: true, **TaxRegime::ROLES.to_h { |role| [:"default_#{role}_tax_category", categories.fetch(item)] }
            )
            call(store: store, regime: regime, previous: nil)
            DirectTax.recount_year!(store, DirectTax.today.year)
            regime
          end
        end

        def category!(store, option)
          scope = Spree::TaxCategory.where(store_id: store.id, tax_code: option[:code])
          live = scope.order(:id).first
          return live if live

          retired = scope.only_deleted.order(deleted_at: :desc).first
          if retired
            retired.restore
            return retired
          end

          name = unique_name(Spree::TaxCategory.where(store_id: store.id), TaxOptions.label(option), option[:code])
          Spree::TaxCategory.create!(store: store, name: name, tax_code: option[:code], description: option[:name], is_default: false)
        end

        def default_item!(store, regime)
          category = regime.default_item_tax_category
          category.update!(is_default: true) unless category.is_default
        end

        # Rates of every live catalog category, including an option whose
        # range has ended but still has products: the deduction method in
        # force gives each rate option one Vietnam rate, anything else none.
        def rates!(store, regime)
          Spree::TaxCategory.where(store_id: store.id).where.not(tax_code: nil).find_each do |category|
            option = VnTaxCatalog.option(category.tax_code)
            next if option.nil?

            rates = Spree::TaxRate.where(store_id: store.id, tax_category_id: category.id).to_a
            unless regime.enabled && regime.deduction? && option[:kind] == 'rate'
              rates.each(&:destroy!)
              next
            end

            rate = rates.find { |row| row.country_code == VN } || create_rate!(store, category, option, regime)
            schedule!(store, rate, option)
          end
        end

        # An existing rate keeps its amount: a schedule may have changed it.
        # Whether the amount sits inside the price is the market's
        # (markets!); Spree 6 no longer reads included_in_price.
        def create_rate!(store, category, option, regime)
          name = unique_name(Spree::TaxRate.where(store_id: store.id), option[:rate_name], option[:code])
          Spree::TaxRate.create!(store: store, tax_category: category, name: name, amount: VnTaxCatalog.deduction_rate(option),
                                 included_in_price: regime.prices_include_tax, show_rate_in_label: false, country_code: VN)
        end

        def schedule!(store, rate, option)
          return unless option[:rate_after] && option[:valid_to] && option[:valid_to] >= Date.current

          TaxRateSchedule.find_or_create_by!(tax_rate: rate, effective_on: option[:valid_to] + 1) do |row|
            row.store = store
            row.amount = option[:rate_after]
          end
        end

        # Spree reads whether prices include tax from the market.
        def markets!(store, regime)
          return unless regime.deduction?

          Spree::Market.where(store_id: store.id).where.not(tax_inclusive: regime.prices_include_tax).find_each do |market|
            market.update!(tax_inclusive: regime.prices_include_tax)
          end
        end

        def reassign_products!(store, regime, previous, apply_to_all)
          return 0 if previous.nil?

          target = regime.default_item_tax_category_id
          scope = Spree::Product.where(store_id: store.id)
          unless apply_to_all || previous.tax_method != regime.tax_method
            old = previous.default_item_tax_category_id
            return 0 if old == target

            scope = scope.where(tax_category_id: [old, nil])
          end
          scope.where('tax_category_id IS DISTINCT FROM ?', target).update_all(tax_category_id: target, updated_at: Time.current)
        end

        # Delivery methods on the previous shipping default (or none) follow
        # the new one; every one moves when the method changes.
        def reassign_delivery_methods!(store, regime, previous)
          return if previous.nil?

          target = regime.default_shipping_tax_category_id
          scope = Spree::DeliveryMethod.where(store_id: store.id)
          scope = scope.where(tax_category_id: [previous.default_shipping_tax_category_id, nil]) if previous.tax_method == regime.tax_method
          scope.where('tax_category_id IS DISTINCT FROM ?', target).update_all(tax_category_id: target, updated_at: Time.current)
        end

        # The other method's categories stop being offered. What still points
        # at them goes back to following the defaults first.
        def retire!(store, regime)
          other = (TaxRegime::METHODS - [regime.tax_method]).first
          retired = Spree::TaxCategory.where(store_id: store.id).where('tax_code LIKE ?', "#{other}.%").to_a
          return if retired.empty?

          ids = retired.map(&:id)
          Branch.where(store_id: store.id, service_charge_tax_category_id: ids).update_all(service_charge_tax_category_id: nil)
          StoreProfile.where(store_id: store.id, food_tax_category_id: ids).update_all(food_tax_category_id: nil)
          StoreProfile.where(store_id: store.id, alcohol_tax_category_id: ids).update_all(alcohol_tax_category_id: nil)
          retired.each(&:destroy!)
        end

        def retag!(store, category, key)
          return if category.nil? || Spree::TaxCategory.where(store_id: store.id, tax_code: key).exists?

          category.update_columns(tax_code: key, updated_at: Time.current)
        end

        # The store's default category as an option: tagged by the rate it
        # carries (none is not taxed). When another category already holds
        # that option it becomes the default instead, at the same rate. A
        # default the catalog cannot express stops the adoption rather than
        # change what the store charges.
        def adopted_default_key(store)
          default = Spree::TaxCategory.default(store)
          return 'deduction.not_taxed' if default.nil?
          return default.tax_code if VnTaxCatalog.method_of(default.tax_code) == 'deduction'

          key = matching_deduction_key(default)
          if key.nil? || default.tax_code.present?
            raise VnTaxCatalog::Invalid, "Store #{store.id}: default tax category #{default.id} matches no deduction option."
          end

          retag!(store, default, key)
          key
        end

        def matching_deduction_key(category)
          rates = category.tax_rates.to_a
          return 'deduction.not_taxed' if rates.empty?
          return nil unless rates.one? && rates.first.country_code == VN

          VnTaxCatalog.options('deduction').find { |option| option[:kind] == 'rate' && option[:vat_rate] == rates.first.amount }&.fetch(:code)
        end

        def store_market(store)
          Spree::Market.where(store_id: store.id).order(default: :desc, id: :asc).first
        end

        # Names are unique per store among live rows; a taken one gets the
        # catalog key.
        def unique_name(scope, base, code)
          scope.exists?(name: base) ? "#{base} (#{code})" : base
        end
      end
    end
  end
end
