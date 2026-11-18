# frozen_string_literal: true

module Spree
  module Pos
    # Vietnam tax catalog (config/pos/vn_tax_catalog.yml): one top-level
    # block per list, each with its basis, last check date and whether it
    # has been verified. Loaded once and cached; `errors_for` checks any hash
    # the same way so specs can feed it a bad catalog.
    #
    # Rates come out as fractions (BigDecimal('0.015') for '1.5'), dates as
    # Date, so callers never parse the file's strings.
    module VnTaxCatalog
      PATH = 'config/pos/vn_tax_catalog.yml'
      LISTS = %w[tax_authorities industries direct_options deduction_options threshold revenue_groups reductions
                 default_by_profile].freeze
      # What GET tax_catalog serves; the rate blocks reach clients through the
      # store's tax options and tax regime.
      PAYLOAD_LISTS = %w[tax_authorities industries].freeze
      INDUSTRY_GROUPS = %w[retail fnb entertainment services].freeze
      METHODS = %w[direct deduction].freeze
      PIT_METHODS = %w[revenue income].freeze
      DEDUCTION_KINDS = %w[exempt not_taxed rate].freeze
      # Business profile groups (config/pos/business_profiles.yml).
      PROFILE_GROUPS = %w[retail fnb].freeze
      DEFAULT_ROLES = %w[item shipping].freeze
      DATE = /\A\d{4}-\d{2}-\d{2}\z/
      NUMBER = /\A\d+(\.\d+)?\z/

      number = ->(value) { value.to_s.match?(NUMBER) }
      optional_number = ->(value) { value.nil? || number.call(value) }
      list_of = ->(value, allowed) { value.is_a?(Array) && value.any? && value.all? { |entry| allowed.include?(entry.to_s) } }
      # Per block: [message, problem?] for each row.
      ITEM_CHECKS = {
        'industries' => [['industries has an unknown group', ->(row) { INDUSTRY_GROUPS.exclude?(row['group'].to_s) }]],
        'direct_options' => [
          ['%<code>s must start with direct.', ->(row) { !row['code'].to_s.start_with?('direct.') }],
          ['%<code>s has no industry', ->(row) { row['industry'].to_s.empty? }],
          ['%<code>s has a bad vat_rate', ->(row) { !optional_number.call(row['vat_rate']) }],
          ['%<code>s has a bad pit_rate', ->(row) { !number.call(row['pit_rate']) }]
        ],
        'deduction_options' => [
          ['%<code>s must start with deduction.', ->(row) { !row['code'].to_s.start_with?('deduction.') }],
          ['%<code>s has an unknown kind', ->(row) { DEDUCTION_KINDS.exclude?(row['kind'].to_s) }],
          ['%<code>s needs a vat_rate and a rate_name',
           ->(row) { row['kind'] == 'rate' && !(number.call(row['vat_rate']) && row['rate_name'].to_s.present?) }],
          ['%<code>s has a vat_rate but is not a rate', ->(row) { row['kind'] != 'rate' && !row['vat_rate'].nil? }],
          ['%<code>s has a bad rate_after', ->(row) { !row['rate_after'].nil? && !(number.call(row['rate_after']) && row['valid_to']) }]
        ],
        'threshold' => [
          ['%<code>s has a bad amount', ->(row) { !number.call(row['amount']) }],
          ['%<code>s has bad warning_percents',
           ->(row) { !(row['warning_percents'].is_a?(Array) && row['warning_percents'].all? { |value| number.call(value) }) }],
          ['%<code>s has bad einvoice_registration_days', ->(row) { !row['einvoice_registration_days'].is_a?(Integer) }]
        ],
        'revenue_groups' => [
          ['%<code>s has a bad revenue range', ->(row) { !(number.call(row['revenue_from']) && optional_number.call(row['revenue_to'])) }],
          ['%<code>s has unknown methods', ->(row) { !list_of.call(row['methods'], METHODS) }],
          ['%<code>s has unknown pit_methods', ->(row) { !list_of.call(row['pit_methods'], PIT_METHODS) }],
          ['%<code>s has a bad pit_income_rate', ->(row) { !optional_number.call(row['pit_income_rate']) }]
        ],
        'reductions' => [
          ['%<code>s has a bad direct_rate_percent', ->(row) { !number.call(row['direct_rate_percent']) }],
          ['%<code>s has no applies_to', ->(row) { !(row['applies_to'].is_a?(Array) && row['applies_to'].any?) }]
        ],
        'default_by_profile' => [['%<code>s is not a profile group', ->(row) { PROFILE_GROUPS.exclude?(row['code'].to_s) }]]
      }.freeze

      class Invalid < StandardError; end

      class << self
        def catalog
          @catalog ||= load!
        end

        def reload!
          @catalog = load!
        end

        def etag
          catalog[:etag]
        end

        def tax_authorities
          catalog[:tax_authorities][:items]
        end

        def industries
          catalog[:industries][:items]
        end

        def tax_authority?(code)
          catalog[:tax_authority_codes].include?(code.to_s)
        end

        def industry?(code)
          catalog[:industry_codes].include?(code.to_s)
        end

        # A direct or deduction option by its key, whatever its dates.
        def option(code)
          catalog[:options][code.to_s]
        end

        # The options of one method in force on `on`, in catalog order.
        def options(method, on: Date.current)
          catalog[:"#{method}_options"][:items].select { |item| valid_on?(item, on) }
        end

        def method_of(code)
          option(code)&.fetch(:method)
        end

        def valid_on?(item, day)
          item[:valid_from] <= day && (item[:valid_to].nil? || day <= item[:valid_to])
        end

        # The VAT rate a deduction option's tax rate has on `on`: its
        # `rate_after` once its range has ended.
        def deduction_rate(option, on: Date.current)
          return option[:rate_after] if option[:rate_after] && option[:valid_to] && on > option[:valid_to]

          option[:vat_rate]
        end

        # A direct option's VAT rate on a business date, reduced by a
        # resolution in force when the store applies reductions. Nil for a
        # variant not subject to VAT.
        def direct_vat_rate(option, on:, reduce:)
          rate = option[:vat_rate]
          return rate if rate.nil? || !reduce

          reduction = reduction_for(option[:code], on)
          reduction ? rate * reduction[:direct_rate_factor] : rate
        end

        def reduction_for(code, day)
          catalog[:reductions][:items].find { |item| item[:applies_to].include?(code) && valid_on?(item, day) }
        end

        # The threshold in force on `on`; before the first one starts, the
        # first one, so an early business date still has a threshold.
        def threshold(on: Date.current)
          items = catalog[:threshold][:items]
          items.find { |item| valid_on?(item, on) } || items.first
        end

        def revenue_groups
          catalog[:revenue_groups][:items]
        end

        def revenue_group(code)
          revenue_groups.find { |item| item[:code] == code.to_s }
        end

        # Default option keys for a business profile group and method on
        # `on`: { item:, service_fee:, shipping: }. Service charges default
        # to the goods option.
        def profile_defaults(group, method, on: Date.current)
          items = catalog[:default_by_profile][:items]
          row = items.find { |item| item[:code] == group.to_s } || items.find { |item| item[:code] == 'retail' }
          picks = DEFAULT_ROLES.to_h do |role|
            [role.to_sym, row[method.to_sym][role.to_sym].find { |code| valid_on?(option(code), on) }]
          end
          { item: picks[:item], service_fee: picks[:item], shipping: picks[:shipping] }
        end

        # What the declaration form reads: each list with its basis.
        def as_payload
          PAYLOAD_LISTS.to_h { |key| [key.to_sym, catalog[key.to_sym]] }
        end

        def errors_for(raw)
          return ['catalog must be a mapping'] unless raw.is_a?(Hash)

          errors = LISTS.flat_map { |key| block_errors(key, raw[key]) }
          errors.empty? ? reference_errors(raw) : errors
        end

        private

        def load!
          raw = YAML.safe_load_file(Rails.root.join(PATH), permitted_classes: [], aliases: false)
          errors = errors_for(raw)
          raise Invalid, "#{PATH}: #{errors.join('; ')}" if errors.any?

          lists = LISTS.to_h { |key| [key.to_sym, block(key, raw[key])] }
          options = (lists[:direct_options][:items] + lists[:deduction_options][:items]).index_by { |item| item[:code] }
          lists.merge(
            etag: Digest::SHA256.hexdigest(JSON.generate(raw.slice(*PAYLOAD_LISTS)))[0, 16],
            tax_authority_codes: lists[:tax_authorities][:items].to_set { |row| row[:code] },
            industry_codes: lists[:industries][:items].to_set { |row| row[:code] },
            options: options.freeze
          ).freeze
        end

        def block(key, raw)
          items = raw['items'].map { |row| item(key, row).freeze }
          { basis: raw['basis'].to_s.squish, updated_on: raw['updated_on'].to_s, verified: raw['verified'] == true,
            items: items.freeze }.freeze
        end

        def item(key, row)
          base = { code: row['code'].to_s, name: row['name'].to_s }
          case key
          when 'industries' then base.merge(group: row['group'].to_s)
          when 'direct_options'
            base.merge(method: 'direct', industry: row['industry'].to_s, vat_rate: rate(row['vat_rate']),
                       pit_rate: rate(row['pit_rate']), vat_exempt: row['vat_rate'].nil?, **range(row))
          when 'deduction_options'
            base.merge(method: 'deduction', kind: row['kind'].to_s, vat_rate: rate(row['vat_rate']),
                       rate_name: row['rate_name']&.to_s, rate_after: rate(row['rate_after']), **range(row))
          when 'threshold'
            base.merge(amount: BigDecimal(row['amount'].to_s), warning_ratios: row['warning_percents'].map { |value| rate(value) }.freeze,
                       einvoice_registration_days: row['einvoice_registration_days'].to_i, **range(row))
          when 'revenue_groups'
            base.merge(revenue_from: BigDecimal(row['revenue_from'].to_s), revenue_to: row['revenue_to'] && BigDecimal(row['revenue_to'].to_s),
                       methods: row['methods'].map(&:to_s).freeze, pit_methods: row['pit_methods'].map(&:to_s).freeze,
                       pit_income_rate: rate(row['pit_income_rate']))
          when 'reductions'
            base.merge(direct_rate_factor: rate(row['direct_rate_percent']), applies_to: row['applies_to'].map(&:to_s).freeze, **range(row))
          when 'default_by_profile'
            base.merge(METHODS.to_h do |method|
              [method.to_sym, DEFAULT_ROLES.to_h { |role| [role.to_sym, row[method][role].map(&:to_s).freeze] }.freeze]
            end)
          else base
          end
        end

        def rate(value)
          value.nil? ? nil : BigDecimal(value.to_s) / 100
        end

        def range(row)
          { valid_from: Date.iso8601(row['valid_from'].to_s), valid_to: row['valid_to'] && Date.iso8601(row['valid_to'].to_s) }
        end

        def block_errors(key, raw)
          return ["#{key} is missing"] unless raw.is_a?(Hash)

          errors = []
          errors << "#{key}.basis is blank" if raw['basis'].to_s.strip.empty?
          errors << "#{key}.updated_on is not a date" unless raw['updated_on'].to_s.match?(DATE)
          errors << "#{key}.verified must be true or false" unless [true, false].include?(raw['verified'])
          items = raw['items']
          return errors << "#{key}.items is empty" unless items.is_a?(Array) && items.any?

          codes = items.map { |row| row.is_a?(Hash) ? row['code'].to_s : '' }
          errors << "#{key} has a blank code" if codes.any?(&:empty?)
          errors << "#{key} repeats #{codes.tally.select { |_, n| n > 1 }.keys.join(', ')}" if codes.uniq.size != codes.size
          errors << "#{key} has an item without a name" if items.any? { |row| !row.is_a?(Hash) || row['name'].to_s.strip.empty? }
          rows = items.grep(Hash)
          errors + rows.flat_map { |row| item_errors(key, row) }.uniq
        end

        # One message per kind of problem, naming the item.
        def item_errors(key, row)
          code = row['code']
          errors = ITEM_CHECKS.fetch(key, []).filter_map { |message, bad| format(message, code: code) if bad.call(row) }
          if key == 'default_by_profile'
            METHODS.each do |method|
              lists = row[method]
              ok = lists.is_a?(Hash) && DEFAULT_ROLES.all? { |role| lists[role].is_a?(Array) && lists[role].any? }
              errors << "#{code} needs #{method} item and shipping lists" unless ok
            end
          end
          errors << "#{code} has a bad validity range" if row.key?('valid_from') && !range?(row)
          errors
        end

        # Keys one block names in another: run once every block is well formed.
        def reference_errors(raw)
          direct = raw['direct_options']['items'].to_h { |row| [row['code'].to_s, row] }
          deduction = raw['deduction_options']['items'].to_h { |row| [row['code'].to_s, row] }
          errors = raw['reductions']['items'].flat_map do |row|
            row['applies_to'].reject { |code| direct.key?(code.to_s) }.map { |code| "#{row['code']} names unknown option #{code}" }
          end
          raw['default_by_profile']['items'].each do |row|
            { 'direct' => direct, 'deduction' => deduction }.each do |method, known|
              DEFAULT_ROLES.each do |role|
                row[method][role].reject { |code| known.key?(code.to_s) }.each do |code|
                  errors << "#{row['code']} #{method} #{role} names unknown option #{code}"
                end
              end
            end
          end
          errors
        end

        def range?(row)
          from = row['valid_from'].to_s
          to = row['valid_to']
          return false unless from.match?(DATE) && (to.nil? || to.to_s.match?(DATE))

          to.nil? || Date.iso8601(from) <= Date.iso8601(to.to_s)
        end
      end
    end
  end
end
