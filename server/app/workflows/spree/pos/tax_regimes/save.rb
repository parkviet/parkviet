# frozen_string_literal: true

module Spree
  module Pos
    module TaxRegimes
      # Saves a store's tax regime as a new history row, in one transaction
      # under the store lock, and syncs the store's tax categories, rates and
      # products to it (Sync). Only keys sent change; the rest come from the
      # regime in force. Default options a new method does not name come
      # from the store's business profile, and the service charge follows the
      # goods option unless it was set apart. The catalog decides which
      # combinations are valid. A save that changes nothing writes nothing.
      # Audited as tax_regime.change with how many products were reassigned.
      module Save
        PERMISSION = 'write_pos_topology'
        FIELDS = %w[enabled method revenue_group pit_method item_option service_fee_option shipping_option
                    prices_include_tax apply_reduction threshold_warning].freeze
        BOOLEANS = %w[enabled prices_include_tax apply_reduction threshold_warning].freeze
        OPEN_ORDERS = %w[editing parked].freeze

        module_function

        def call(store:, actor:, attributes:, apply_to_all_products: false)
          raise CanCan::AccessDenied unless AccessPolicy.new(store: store, staff: actor).permission?(PERMISSION)

          everything = boolean(apply_to_all_products)
          raise Conflict.new('apply_to_all_products must be true or false.', reason: 'parameter_invalid') if everything.nil?

          ApplicationRecord.transaction do
            store.lock!
            previous = TaxRegime.current(store) || Sync.adopt!(store)
            regime = build(store, attributes, previous: previous)
            regime.validate!
            changed = regime.settings != previous.settings
            next present(store) unless changed || everything

            current = changed ? persist!(store, regime, actor) : previous
            result = Sync.call(store: store, regime: current, previous: previous, apply_to_all_products: everything)
            AuditEntry.record!(store: store, actor: actor, action: 'tax_regime.change', subject: current,
                               metadata: { from: previous.settings, to: current.settings, apply_to_all_products: everything,
                                           reassigned_products: result[:reassigned_products] })
            present(store)
          end
        end

        # The regime `attributes` describe over `previous`, unsaved. Values
        # of the wrong type are kept as nil so validation names the field.
        def build(store, attributes, previous:)
          hash = plain(attributes)
          method = hash.key?('method') ? hash['method'].to_s : previous.tax_method
          group = hash.key?('revenue_group') ? hash['revenue_group'].to_s : previous.revenue_group
          allowed = VnTaxCatalog.revenue_group(group)&.fetch(:pit_methods) || []
          pit = if hash.key?('pit_method') then hash['pit_method']&.to_s
                elsif allowed.include?(previous.pit_method) then previous.pit_method
                else allowed.first
                end
          TaxRegime.new(
            store: store, tax_method: method, revenue_group: group, pit_method: pit,
            pit_income_rate: pit == 'income' ? VnTaxCatalog.revenue_group(group)&.fetch(:pit_income_rate) : nil,
            **BOOLEANS.to_h { |field| [field.to_sym, hash.key?(field) ? boolean(hash[field]) : previous.public_send(field)] },
            **options(store, hash, previous, method)
          )
        end

        # The regime in force, or the one a store without any would adopt.
        def baseline(store)
          TaxRegime.current(store) || begin
            group = VnTaxCatalog.revenue_group('group_3')
            regime = TaxRegime.new(store: store, enabled: true, tax_method: 'deduction', revenue_group: group[:code],
                                   pit_method: group[:pit_methods].first, pit_income_rate: group[:pit_income_rate],
                                   prices_include_tax: true, apply_reduction: false, threshold_warning: true)
            TaxRegime::ROLES.each { |role| regime.public_send(:"#{role}_option=", 'deduction.not_taxed') }
            regime
          end
        end

        def present(store)
          regime = TaxRegime.current(store)
          products = Spree::Product.where(store_id: store.id)
          counts = products.group(:tax_category_id).count
          categories = Spree::TaxCategory.with_deleted.where(id: counts.keys.compact).index_by(&:id)
          {
            regime: regime&.to_pos,
            options: TaxOptions.for(store),
            available_options: TaxRegime::METHODS.to_h { |method| [method, TaxOptions.catalog(method)] },
            suggested_defaults: TaxRegime::METHODS.to_h { |method| [method, VnTaxCatalog.profile_defaults(profile_group(store), method)] },
            revenue_groups: VnTaxCatalog.revenue_groups.map { |group| group_payload(group) },
            product_count: counts.values.sum,
            product_counts: counts.map do |id, count|
              { tax_category_id: categories[id]&.prefixed_id, option: categories[id]&.tax_code, count: count }
            end,
            open_orders: Workspace.where(store_id: store.id, operational_status: OPEN_ORDERS).count,
            revenue_year: DirectTax.year_summary(store, regime: regime),
            readiness: readiness(store)
          }
        end

        def persist!(store, regime, actor)
          categories = Sync.categories!(store, regime.tax_method)
          TaxRegime::ROLES.each do |role|
            regime.public_send(:"default_#{role}_tax_category=", categories.fetch(regime.public_send(:"#{role}_option")))
          end
          regime.changed_by = actor
          regime.save!(validate: false)
          regime
        end

        # Sent keys win. Within the same method the previous defaults stay;
        # a new method starts from the profile's. The service charge follows
        # the goods option while it was the same one.
        def options(store, hash, previous, method)
          base = if method == previous.tax_method
                   previous.option_keys.transform_keys(&:to_sym)
                 else
                   VnTaxCatalog.profile_defaults(profile_group(store), method)
                 end
          item = hash.key?('item_option') ? hash['item_option']&.to_s : base[:item]
          follows = method != previous.tax_method || previous.service_fee_option == previous.item_option
          service = if hash.key?('service_fee_option') then hash['service_fee_option']&.to_s
                    elsif follows then item
                    else base[:service_fee]
                    end
          shipping = hash.key?('shipping_option') ? hash['shipping_option']&.to_s : base[:shipping]
          { item_option: item, service_fee_option: service, shipping_option: shipping }
        end

        def profile_group(store)
          key = StoreProfile.for_store(store).pick(:profile_key)
          (key && BusinessProfiles.find(key)&.group) || 'retail'
        end

        def group_payload(group)
          { code: group[:code], name: group[:name], revenue_from: group[:revenue_from].to_s('F'),
            revenue_to: group[:revenue_to]&.to_s('F'), methods: group[:methods], pit_methods: group[:pit_methods],
            pit_income_rate: group[:pit_income_rate]&.to_s('F') }
        end

        # What the tax declaration still lacks (TaxProfile#readiness).
        def readiness(store)
          profile = TaxProfile.for_store(store) || TaxProfile.new(store: store)
          head_office = BranchInfo.where(store_id: store.id, tax_head_office: true).first
          profile.readiness(info: StoreInfo.for_store(store), head_office: head_office)
        end

        def boolean(value)
          return value if [true, false].include?(value)

          { 'true' => true, 'false' => false }[value]
        end

        def plain(value)
          hash = value.respond_to?(:to_unsafe_h) ? value.to_unsafe_h : value
          raise Conflict.new('The tax regime must be an object.', reason: 'parameter_invalid') unless hash.is_a?(Hash)

          hash.to_h.stringify_keys.slice(*FIELDS)
        end
      end
    end
  end
end
