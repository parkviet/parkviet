# frozen_string_literal: true

module Spree
  module Pos
    # Validates the config (schema 1) of a product label template: the page
    # font and margins plus one entry per printable field, in print order.
    # Every key is whitelisted and every field appears exactly once.
    # Mirrored by the editor's `product-label/validate.ts`; both are checked
    # against `spec/fixtures/product_label_schema_cases.json`.
    #
    # Errors carry a JSON pointer into the request body
    # (`/config/fields/2/max_lines`), like ReceiptTemplateSchema.
    class ProductLabelSchema
      VERSION = 1
      MAX_BYTES = 16 * 1024
      MAX_TEXT_LENGTH = 60
      MAX_LABEL_LENGTH = 24
      FONT_SIZE_RANGE = [6, 14].freeze
      MARGIN_RANGE = [0, 5].freeze
      MAX_LINES_RANGE = [1, 3].freeze
      MARGIN_SIDES = %w[top right bottom left].freeze
      SYMBOLOGIES = %w[auto code128 ean13].freeze
      CURRENCIES = %w[symbol code none].freeze

      TOP_KEYS = %w[schema page fields].freeze
      PAGE_KEYS = %w[font_size margins].freeze
      # Per field: the keys beyond `key` and `enabled` it accepts.
      FIELD_KEYS = {
        'store_name' => %w[text],
        'store_address' => %w[text],
        'product_name' => %w[max_lines],
        'variant_options' => %w[],
        'barcode' => %w[symbology show_text],
        'sku' => %w[label],
        'unit' => %w[label],
        'price' => %w[label currency],
        'original_price' => %w[],
        'printed_date' => %w[label]
      }.freeze
      FIELDS = FIELD_KEYS.keys.freeze

      def self.validate(config, root: '/config')
        new(config, root).errors
      end

      attr_reader :errors

      def initialize(config, root)
        @errors = []
        @root = root
        check_config(config)
      end

      private

      def add(pointer, code, message)
        @errors << { pointer: pointer, code: code, message: message }
        nil
      end

      def at(*parts)
        ([@root] + parts.map { |part| part.to_s.gsub('~', '~0').gsub('/', '~1') }).join('/')
      end

      def check_config(config)
        return add(at, 'invalid_type', 'Config must be an object.') unless config.is_a?(Hash)
        return add(at, 'too_large', "Config must be at most #{MAX_BYTES / 1024} KB.") if config.to_json.bytesize > MAX_BYTES

        known_keys(config, TOP_KEYS)
        TOP_KEYS.each { |key| add(at(key), 'missing', "#{key} is required.") unless config.key?(key) }
        add(at('schema'), 'unsupported', "Schema must be #{VERSION}.") if config.key?('schema') && config['schema'] != VERSION
        check_page(config['page']) if config.key?('page')
        check_fields(config['fields']) if config.key?('fields')
      end

      def known_keys(hash, allowed, *path)
        (hash.keys - allowed).each { |key| add(at(*path, key), 'unknown_key', "#{key} is not supported.") }
      end

      def check_page(page)
        return add(at('page'), 'invalid_type', 'page must be an object.') unless page.is_a?(Hash)

        known_keys(page, PAGE_KEYS, 'page')
        PAGE_KEYS.each { |key| add(at('page', key), 'missing', "#{key} is required.") unless page.key?(key) }
        number(page, 'font_size', *FONT_SIZE_RANGE, 'page') if page.key?('font_size')
        check_margins(page['margins']) if page.key?('margins')
      end

      def check_margins(margins)
        return add(at('page', 'margins'), 'invalid_type', 'margins must be an object.') unless margins.is_a?(Hash)

        known_keys(margins, MARGIN_SIDES, 'page', 'margins')
        MARGIN_SIDES.each do |side|
          if margins.key?(side)
            number(margins, side, *MARGIN_RANGE, 'page', 'margins')
          else
            add(at('page', 'margins', side), 'missing', "#{side} is required.")
          end
        end
      end

      def check_fields(fields)
        return add(at('fields'), 'invalid_type', 'fields must be a list.') unless fields.is_a?(Array)

        seen = []
        fields.each_with_index do |field, index|
          next add(at('fields', index), 'invalid_type', 'A field must be an object.') unless field.is_a?(Hash)

          key = field['key']
          next add(at('fields', index, 'key'), 'field_unavailable', "#{key.inspect} is not a label field.") unless FIELDS.include?(key)
          next add(at('fields', index, 'key'), 'duplicate', "#{key} is listed twice.") if seen.include?(key)

          seen << key
          check_field(field, key, index)
        end
        (FIELDS - seen).each { |key| add(at('fields'), 'missing', "#{key} is required.") }
      end

      def check_field(field, key, index)
        path = ['fields', index]
        known_keys(field, %w[key enabled] + FIELD_KEYS.fetch(key), *path)
        if field.key?('enabled')
          boolean(field, 'enabled', *path)
        else
          add(at(*path, 'enabled'), 'missing', 'enabled is required.')
        end
        text(field, 'text', MAX_TEXT_LENGTH, *path) if field.key?('text')
        text(field, 'label', MAX_LABEL_LENGTH, *path) if field.key?('label')
        whole_number(field, 'max_lines', *MAX_LINES_RANGE, *path) if field.key?('max_lines')
        choice(field, 'symbology', SYMBOLOGIES, *path) if field.key?('symbology')
        boolean(field, 'show_text', *path) if field.key?('show_text')
        choice(field, 'currency', CURRENCIES, *path) if field.key?('currency')
      end

      # A custom text or label is a string, or null for the built-in one.
      def text(hash, key, max, *path)
        value = hash[key]
        return if value.nil?
        return add(at(*path, key), 'invalid_type', "#{key} must be text.") unless value.is_a?(String)

        add(at(*path, key), 'too_long', "#{key} must be at most #{max} characters.") if value.length > max
      end

      def choice(hash, key, allowed, *path)
        add(at(*path, key), 'invalid_value', "#{key} must be one of #{allowed.join(', ')}.") unless allowed.include?(hash[key])
      end

      def boolean(hash, key, *path)
        add(at(*path, key), 'invalid_type', "#{key} must be true or false.") unless [true, false].include?(hash[key])
      end

      def number(hash, key, min, max, *path)
        value = hash[key]
        return if value.is_a?(Numeric) && value.finite? && value.between?(min, max)

        add(at(*path, key), 'invalid_value', "#{key} must be a number from #{min} to #{max}.")
      end

      def whole_number(hash, key, min, max, *path)
        value = hash[key]
        return if value.is_a?(Integer) && value.between?(min, max)

        add(at(*path, key), 'invalid_value', "#{key} must be a whole number from #{min} to #{max}.")
      end
    end
  end
end
