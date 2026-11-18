# frozen_string_literal: true

module Spree
  module Pos
    # Vietnam tax catalog (config/pos/vn_tax_catalog.yml): one top-level
    # block per list, each with its basis, last check date and whether it
    # has been verified. Loaded once and cached; `errors_for` checks any hash
    # the same way so specs can feed it a bad catalog.
    module VnTaxCatalog
      PATH = 'config/pos/vn_tax_catalog.yml'
      LISTS = %w[tax_authorities industries].freeze
      INDUSTRY_GROUPS = %w[retail fnb entertainment services].freeze

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

        # What the declaration form reads: each list with its basis.
        def as_payload
          LISTS.to_h { |key| [key.to_sym, catalog[key.to_sym]] }
        end

        def errors_for(raw)
          return ['catalog must be a mapping'] unless raw.is_a?(Hash)

          LISTS.flat_map { |key| block_errors(key, raw[key]) }
        end

        private

        def load!
          raw = YAML.safe_load_file(Rails.root.join(PATH), permitted_classes: [], aliases: false)
          errors = errors_for(raw)
          raise Invalid, "#{PATH}: #{errors.join('; ')}" if errors.any?

          lists = LISTS.to_h { |key| [key.to_sym, block(key, raw[key])] }
          lists.merge(
            etag: Digest::SHA256.hexdigest(JSON.generate(raw))[0, 16],
            tax_authority_codes: lists[:tax_authorities][:items].to_set { |row| row[:code] },
            industry_codes: lists[:industries][:items].to_set { |row| row[:code] }
          ).freeze
        end

        def block(key, raw)
          items = raw['items'].map do |row|
            item = { code: row['code'].to_s, name: row['name'].to_s }
            item[:group] = row['group'].to_s if key == 'industries'
            item.freeze
          end
          { basis: raw['basis'].to_s.squish, updated_on: raw['updated_on'].to_s, verified: raw['verified'] == true,
            items: items.freeze }.freeze
        end

        def block_errors(key, raw)
          return ["#{key} is missing"] unless raw.is_a?(Hash)

          errors = []
          errors << "#{key}.basis is blank" if raw['basis'].to_s.strip.empty?
          errors << "#{key}.updated_on is not a date" unless raw['updated_on'].to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/)
          errors << "#{key}.verified must be true or false" unless [true, false].include?(raw['verified'])
          items = raw['items']
          return errors << "#{key}.items is empty" unless items.is_a?(Array) && items.any?

          codes = items.map { |row| row.is_a?(Hash) ? row['code'].to_s : '' }
          errors << "#{key} has a blank code" if codes.any?(&:empty?)
          errors << "#{key} repeats #{codes.tally.select { |_, n| n > 1 }.keys.join(', ')}" if codes.uniq.size != codes.size
          errors << "#{key} has an item without a name" if items.any? { |row| !row.is_a?(Hash) || row['name'].to_s.strip.empty? }
          if key == 'industries' && items.any? { |row| row.is_a?(Hash) && INDUSTRY_GROUPS.exclude?(row['group'].to_s) }
            errors << 'industries has an unknown group'
          end
          errors
        end
      end
    end
  end
end
