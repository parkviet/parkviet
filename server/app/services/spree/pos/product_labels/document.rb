# frozen_string_literal: true

module Spree
  module Pos
    module ProductLabels
      # The document a print station prints product labels from: for each item
      # the rows its template shows (text, barcode, price) and how many copies,
      # on a roll stock. It follows apps/pos/src/shared/product-label
      # (render.ts and document.ts), choosing the fields and formatting the
      # values the same way; both are checked against the shared fixtures in
      # spec/fixtures/product_labels.
      #
      # The station draws only what the rows say. Which symbology a code prints
      # in, and whether it fits the sticker, is decided here.
      class Document
        VERSION = 1
        KIND = 'product_label'
        MAX_LABELS_PER_JOB = 2000

        # Code 128 (set B) and EAN-13 sizes, as in the shared barcode code.
        MAX_BARCODE_LENGTH = 24
        QUIET_ZONE = 10
        MIN_MODULE_MM = 0.25
        EAN13_MODULES = 95
        WHITESPACE_ENDS = /\A[[:space:]]+|[[:space:]]+\z/
        CURRENCY_SUFFIX = /\s(₫|[A-Z]{3})\z/

        # One document per `max_labels` labels; an item's copies may be split
        # across two documents.
        def self.jobs(config:, preset:, items:, store:, now:, time_zone:, max_labels: MAX_LABELS_PER_JOB)
          split(items, max_labels).map do |chunk|
            build(config: config, preset: preset, items: chunk, store: store, now: now, time_zone: time_zone)
          end
        end

        def self.build(config:, preset:, items:, store:, now:, time_zone:)
          new(config, preset, store, now, time_zone).build(items)
        end

        def self.split(items, max_labels)
          chunks = [[]]
          room = max_labels
          items.each do |raw|
            item = raw.to_h.with_indifferent_access
            left = item[:quantity].to_i
            while left.positive?
              if room.zero?
                chunks << []
                room = max_labels
              end
              take = [left, room].min
              chunks.last << item.merge(quantity: take)
              left -= take
              room -= take
            end
          end
          chunks.reject(&:empty?)
        end

        def initialize(config, preset, store, now, time_zone)
          @config = config.deep_stringify_keys
          @preset = preset.deep_stringify_keys
          @store = (store || {}).to_h.with_indifferent_access
          @printed_date = now.in_time_zone(time_zone).strftime('%d/%m/%Y')
          @price_style = (@config['fields'].find { |field| field['key'] == 'price' } || {}).fetch('currency', 'symbol')
        end

        def build(items)
          margins = @config.dig('page', 'margins')
          label = @preset.fetch('label_mm')
          {
            'version' => VERSION,
            'kind' => KIND,
            'page' => { 'label' => { 'width_mm' => label.fetch('width'), 'height_mm' => label.fetch('height'),
                                     'columns' => @preset.fetch('columns'), 'gap_mm' => @preset.dig('gap_mm', 'y'),
                                     'column_gap_mm' => @preset.dig('gap_mm', 'x'), 'roll_width_mm' => @preset.fetch('roll_width_mm') } },
            'font_size' => @config.dig('page', 'font_size'),
            'margins' => margins.slice('top', 'right', 'bottom', 'left'),
            'labels' => items.map { |item| label_for(item.to_h.with_indifferent_access) }
          }
        end

        private

        def label_for(item)
          { 'rows' => rows_for(item), 'copies' => [item[:quantity].to_i, 0].max }
        end

        # The original price rides on the price row, small above it; without a
        # price row it has nothing to sit above and is left out.
        def rows_for(item)
          rows = []
          original = nil
          @config['fields'].each do |field|
            next unless field['enabled']

            if field['key'] == 'original_price'
              original = format_price(item[:original_price], item[:currency], @price_style)
            else
              row = row_for(field, item)
              rows << row if row
            end
          end
          price = rows.find { |row| row['kind'] == 'price' }
          price['original'] = original if price && original
          rows
        end

        def row_for(field, item)
          case field['key']
          when 'store_name' then text_row(present(field['text']) || present(@store[:name]))
          when 'store_address' then text_row(present(field['text']) || present(@store[:address]))
          when 'product_name' then text_row(present(item[:product_name]), 'max_lines' => field['max_lines'])
          when 'variant_options' then text_row(present(item[:variant_options]))
          when 'barcode' then barcode_row(field, item)
          when 'sku' then captioned(field, present(item[:sku]))
          when 'unit' then captioned(field, present(item[:unit]))
          when 'price' then price_row(field, item)
          when 'printed_date' then captioned(field, @printed_date)
          end
        end

        def text_row(text, extra = {})
          text && { 'kind' => 'text', 'text' => text }.merge(extra)
        end

        def captioned(field, text)
          return nil unless text

          caption = present(field['label'])
          text_row(caption ? "#{caption} #{text}" : text)
        end

        def price_row(field, item)
          text = format_price(item[:price], item[:currency], field['currency'])
          return nil unless text

          caption = present(field['label'])
          { 'kind' => 'price', 'text' => caption ? "#{caption} #{text}" : text }
        end

        def barcode_row(field, item)
          code = present(item[:barcode]) || present(item[:sku])
          return nil unless code

          symbology = barcode_symbology(code, field['symbology'])
          return text_row(code) unless symbology

          { 'kind' => 'barcode', 'symbology' => symbology, 'value' => code, 'show_text' => field['show_text'] ? true : false }
        end

        # `ean13` or `code128`, or nil when the code prints as text: it cannot
        # be encoded, or its bars would be narrower than a scanner reads.
        def barcode_symbology(code, requested)
          margins = @config.dig('page', 'margins')
          printable = [@preset.dig('label_mm', 'width') - margins['left'] - margins['right'], 0].max
          if requested != 'code128' && ean13?(code)
            return (EAN13_MODULES + QUIET_ZONE * 2) * MIN_MODULE_MM > printable ? nil : 'ean13'
          end
          return nil unless code128?(code)

          modules = 11 * (code.length + 2) + 13
          (modules + QUIET_ZONE * 2) * MIN_MODULE_MM > printable ? nil : 'code128'
        end

        def ean13?(code)
          return false unless code.match?(/\A[0-9]{13}\z/)

          sum = code[0, 12].each_char.each_with_index.sum { |digit, index| digit.to_i * (index.even? ? 1 : 3) }
          (10 - (sum % 10)) % 10 == code[12].to_i
        end

        def code128?(code)
          code.length <= MAX_BARCODE_LENGTH && code.each_char.all? { |char| char.ord.between?(32, 126) }
        end

        def present(value)
          text = value.to_s.gsub(WHITESPACE_ENDS, '')
          text.empty? ? nil : text
        end

        # The amount as the template's currency setting asks, as formatLabelPrice does.
        def format_price(amount, currency, style)
          return nil unless amount.to_s.match?(/\A-?\d+(?:\.\d+)?\z/)

          whole, fraction = amount.to_s.split('.')
          fraction = fraction.to_s.sub(/0+\z/, '')
          grouped = whole.gsub(/\B(?=(\d{3})+(?!\d))/, '.')
          number = fraction.empty? ? grouped : "#{grouped},#{fraction}"
          text = "#{number} #{currency == 'VND' ? '₫' : currency}"
          return text if style == 'symbol'

          bare = text.sub(CURRENCY_SUFFIX, '')
          style == 'none' ? bare : "#{bare} #{currency == 'VND' ? 'VNĐ' : currency}"
        end
      end
    end
  end
end
