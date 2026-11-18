# frozen_string_literal: true

module Spree
  module Pos
    module PrintDocuments
      # Template x data -> a resolved document, mirroring
      # receipt-template/render.ts and variables.ts. The template decides what
      # shows and how it is labelled; it cannot remove the banners, the title
      # and number, the total or the disclaimer. Anything unknown or malformed
      # is skipped rather than failing the print.
      module Renderer
        MAX_BLOCKS = 8
        MAX_TEXT_LENGTH = 500
        MAX_TITLE_LENGTH = 60
        MAX_LABEL_LENGTH = 40
        MAX_URL_LENGTH = 300
        MAX_CAPTION_LENGTH = 60
        MAX_VARIABLE_LENGTH = 120
        MAX_BARCODE_LENGTH = 24
        ALIGNS = %w[left center right].freeze
        SIZES = %w[s m l].freeze
        TITLE_SIZES = %w[m l xl].freeze
        TABLE_STYLES = %w[one_line two_lines].freeze
        TIME_FORMATS = %w[datetime date].freeze
        LINE_RULINGS = %w[none rows grid].freeze
        QR_SIZES = %w[s m l].freeze
        QR_CAPTIONS = %w[below above left right].freeze
        TIME_FIELDS = %w[time check_in check_out printed_at].freeze
        ALL_COLUMNS = %w[index name sku barcode unit qty original_price price discount amount note].freeze
        TABLE_COLUMNS = %w[qty price discount amount].freeze
        SIGNATURE_PARTIES = %w[buyer seller cashier].freeze
        SOCIAL_PAGES = { 'facebook' => 'https://www.facebook.com/', 'instagram' => 'https://www.instagram.com/' }.freeze
        PCHAR = "(?:[A-Za-z0-9\\-._~!$&'()*+,;=:@]|%[0-9A-Fa-f]{2})"
        WEB_URL = %r{\Ahttps?://[A-Za-z0-9\-._~]+(?::\d+)?(?:/(?:#{PCHAR}|/)*)?(?:\?(?:#{PCHAR}|[/?])*)?(?:\#(?:#{PCHAR}|[/?])*)?\z}i
        VARIABLE = /\{([a-z_]+(?:\.[a-z_]+)?)\}/

        module_function

        def call(config, data, banner: nil)
          config = {} unless config.is_a?(Hash)
          banners = [data[:banner], banner].map { |entry| entry ? Text.trim(entry) : '' }.reject(&:empty?)
          resolved_transfer_qr = transfer_qr(data, config['payments'])
          resolved_einvoice = einvoice_section(data, config['einvoice'])
          document = {
            'documentType' => data[:document_type], 'page' => page(config['page']), 'banners' => banners,
            'header' => blocks(config['header'], data, 'header'), 'meta' => meta_rows(data, config['meta']),
            'lines' => lines(data, config['lines']), 'totals' => field_rows(data[:totals], config['totals'], locked: ['total']),
            'payments' => field_rows(data[:payments], config['payments'], fixed_labels: ['methods']),
            'payQr' => pay_qr(data, config['payments'])
          }
          document['transferQr'] = resolved_transfer_qr unless resolved_transfer_qr.nil?
          document['einvoice'] = resolved_einvoice unless resolved_einvoice.nil?
          document.merge(
            'notes' => data[:notes],
            'footer' => blocks(config['footer'], data, 'footer', suppress_buyer_qr: !resolved_einvoice.nil?),
            'disclaimer' => data[:disclaimer]
          )
        end

        def clip(value, max)
          value.length > max ? "#{value[0, max - 1]}…" : value
        end

        def pick(value, allowed, fallback)
          value.is_a?(String) && allowed.include?(value) ? value : fallback
        end

        def pick_optional(value, allowed)
          value.is_a?(String) && allowed.include?(value) ? value : nil
        end

        def clamp(value, min, max, fallback)
          value.is_a?(Numeric) && value.to_f.finite? ? value.clamp(min, max) : fallback
        end

        def text_of(value)
          value.is_a?(String) ? Text.trim(value) : ''
        end

        def parse_margins(raw)
          return nil unless raw.is_a?(Hash)
          return nil unless %w[top right bottom left].any? { |side| raw[side].is_a?(Numeric) }

          { 'top' => clamp(raw['top'], 0, 15, 0), 'right' => clamp(raw['right'], 0, 15, 0),
            'bottom' => clamp(raw['bottom'], 0, 15, 0), 'left' => clamp(raw['left'], 0, 15, 0) }
        end

        def page(settings)
          settings = {} unless settings.is_a?(Hash)
          result = { 'margin_mm' => clamp(settings['margin_mm'], 0, 20, 3) }
          margins = parse_margins(settings['margins'])
          result['margins'] = margins if margins
          if settings['cut_feed_mm'].is_a?(Numeric) && settings['cut_feed_mm'].to_f.finite?
            result['cut_feed_mm'] = clamp(settings['cut_feed_mm'], 0, 30, 0)
          end
          result.merge(
            'font' => pick(settings['font'], %w[sans mono], 'sans'),
            'font_size' => pick(settings['font_size'], SIZES, 'm'),
            'line_spacing' => clamp(settings['line_spacing'], 1, 1.6, 1.35)
          )
        end

        def web_url?(value)
          value != '' && value.length <= MAX_URL_LENGTH && value.match?(WEB_URL)
        end

        def store_page(field, data)
          value = Text.trim(data[:store][field.to_sym].to_s)
          return nil if value == ''
          return value if value.match?(%r{\Ahttps?://}i)
          return "https://#{value}" if field == 'url' || value.match?(%r{\A[\w-]+(\.[\w-]+)+(/|\z)})

          "#{SOCIAL_PAGES[field]}#{value.sub(/\A@/, '')}"
        end

        def qr_link(block, data)
          link = if block['source'] == 'url'
                   text_of(block['value'])
                 elsif block['source'] == 'store_social' && %w[url facebook instagram].include?(block['field'])
                   store_page(block['field'], data)
                 end
          link && web_url?(link) ? link : nil
        end

        def signature_labels(block, data)
          parties = block['parties'].is_a?(Array) ? block['parties'] : []
          labels = block['labels'].is_a?(Hash) ? block['labels'] : {}
          SIGNATURE_PARTIES.select { |party| parties.include?(party) }.map do |party|
            custom = clip(text_of(labels[party]), MAX_LABEL_LENGTH)
            { 'party' => party, 'label' => custom.empty? ? data[:signature_labels][party] : custom }
          end
        end

        def business_lines(fields, data)
          return [] unless fields.is_a?(Array)

          store = data[:store]
          values = { 'name' => store[:name], 'branch' => data[:branch][:name], 'address' => store[:address], 'phone' => store[:phone],
                     'email' => store[:email], 'tax_code' => store[:tax_code], 'description' => store[:description],
                     'url' => store[:url], 'facebook' => store[:facebook], 'instagram' => store[:instagram] }
          fields.select { |field| field.is_a?(String) && values.key?(field) }.
            map { |field| Text.trim(values[field].to_s) }.reject(&:empty?).map { |value| clip(value, MAX_TEXT_LENGTH) }
        end

        def title_block(label, size, data)
          custom = clip(text_of(label), MAX_TITLE_LENGTH)
          resolved_size = pick_optional(size, TITLE_SIZES)
          block = { 'kind' => 'title', 'title' => custom.empty? ? data[:title] : custom, 'number' => data[:number] }
          block['size'] = resolved_size if resolved_size
          block
        end

        def barcode_value?(text)
          text != '' && text.length <= MAX_BARCODE_LENGTH && text.each_char.all? { |char| char.ord.between?(32, 126) }
        end

        def resolve_block(block, data)
          align = pick(block['align'], ALIGNS, 'center')
          case block['type']
          when 'logo' then logo_block(block, data, align)
          when 'qr' then qr_block(block, data, align)
          when 'barcode' then data[:number] && barcode_value?(data[:number]) ? { 'kind' => 'barcode', 'value' => data[:number], 'align' => align } : nil
          when 'signatures'
            parties = signature_labels(block, data)
            parties.any? ? { 'kind' => 'signatures', 'parties' => parties } : nil
          when 'business'
            found = business_lines(block['fields'], data)
            found.any? ? { 'kind' => 'text', 'lines' => found, 'align' => align, 'bold' => false, 'size' => 'm' } : nil
          when 'text' then text_block(block, data, align)
          when 'title' then title_block(block['label'], block['size'], data)
          when 'divider' then { 'kind' => 'divider', 'style' => pick(block['style'], %w[solid dashed], 'dashed') }
          when 'spacer' then { 'kind' => 'spacer', 'mm' => clamp(block['mm'], 1, 10, 2) }
          end
        end

        def logo_block(block, data, align)
          src = data[:store][:logo_url]
          return nil unless src&.match?(%r{\A(https?://|/)}i)

          { 'kind' => 'image', 'src' => src, 'alt' => data[:store][:name].to_s, 'widthPct' => clamp(block['width_pct'], 20, 100, 60),
            'align' => align, 'monochrome' => block['monochrome'] == true }
        end

        def qr_block(block, data, align)
          value = qr_link(block, data)
          return nil unless value

          caption = clip(text_of(block['caption']), MAX_CAPTION_LENGTH)
          { 'kind' => 'qr', 'value' => value, 'caption' => caption.empty? ? nil : caption, 'align' => align }
        end

        def text_block(block, data, align)
          found = clip(text_of(block['value']), MAX_TEXT_LENGTH).split(/\r?\n/).
                  map { |line| resolve_text(line, data) }.reject { |line| line[:blank] }.map { |line| line[:text] }
          return nil if found.empty?

          { 'kind' => 'text', 'lines' => found, 'align' => align, 'bold' => block['bold'] == true, 'size' => pick(block['size'], SIZES, 'm') }
        end

        def variable_values(data)
          store = data[:store]
          { 'store.name' => store[:name], 'store.address' => store[:address], 'store.phone' => store[:phone], 'store.email' => store[:email],
            'store.url' => store[:url], 'store.facebook' => store[:facebook], 'store.instagram' => store[:instagram],
            'branch.name' => data[:branch][:name], 'branch.code' => data[:branch][:code],
            'branch.return_window_days' => data[:branch][:return_window_days]&.to_s, 'register.name' => data[:register],
            'cashier' => data[:cashier], 'document.number' => data[:number], 'document.time' => data[:time],
            'document.business_date' => data[:business_date], 'document.taxes' => data[:taxes_text],
            'order.call_number' => data[:call_number], 'order.guest_name' => data[:guest_name],
            'customer.name' => data[:customer_name], 'customer.phone' => data[:customer_phone], 'customer.address' => data[:customer_address],
            'einvoice.lookup_code' => data[:einvoice_lookup_code], 'einvoice.lookup_url' => data[:einvoice_lookup_url],
            'einvoice.buyer_qr' => data[:einvoice_buyer_url] }
        end

        # A line whose known variables are all empty disappears.
        def resolve_text(text, data)
          values = variable_values(data)
          named = 0
          filled = 0
          resolved = text.gsub(VARIABLE) do |whole|
            name = Regexp.last_match(1)
            next whole unless values.key?(name)

            named += 1
            value = clip(Text.trim(values[name].to_s), MAX_VARIABLE_LENGTH)
            filled += 1 unless value.empty?
            value
          end
          { text: resolved, blank: Text.trim(resolved) == '' || (named.positive? && filled.zero?) }
        end

        def blocks(list, data, place, suppress_buyer_qr: false)
          result = []
          titled = false
          (list.is_a?(Array) ? list.first(MAX_BLOCKS) : []).each do |block|
            next unless block.is_a?(Hash)

            if block['type'] == 'title'
              next if place == 'footer' || titled

              titled = true
            end
            resolved = resolve_block(block, data)
            result << resolved if resolved
          end
          result << title_block(nil, nil, data) if place == 'header' && !titled
          einvoice = place == 'footer' && !suppress_buyer_qr ? einvoice_qr(data) : nil
          result << einvoice if einvoice
          result
        end

        # While the sale's e-invoice still takes buyer details and no structured
        # `einvoice` block is rendered, the footer ends with the buyer's page QR.
        def einvoice_qr(data)
          url = data[:einvoice_buyer_url].to_s
          return nil unless web_url?(url)

          { 'kind' => 'qr', 'value' => url, 'caption' => data[:einvoice_buyer_caption], 'align' => 'center' }
        end

        def field_rows(rows, section, locked: [], fixed_labels: [])
          section = {} unless section.is_a?(Hash)
          enabled = section['fields'].is_a?(Array) ? section['fields'] : nil
          labels = section['labels'].is_a?(Hash) ? section['labels'] : {}
          rows.select { |row| row[:field].nil? || enabled.nil? || enabled.include?(row[:field]) || locked.include?(row[:field]) }.
            reject { |row| Text.trim(row[:value].to_s).empty? }.
            map do |row|
              custom = row[:field] && !fixed_labels.include?(row[:field]) ? clip(text_of(labels[row[:field]]), MAX_LABEL_LENGTH) : ''
              label = "#{custom.empty? ? row[:label] : custom}#{row[:label_suffix]}"
              printed = { 'label' => label, 'value' => row[:value] }
              row[:strong] ? printed.merge('strong' => true) : printed
            end
        end

        def meta_rows(data, section)
          section = {} unless section.is_a?(Hash)
          enabled = section['fields'].is_a?(Array) ? section['fields'] : nil
          labels = section['labels'].is_a?(Hash) ? section['labels'] : {}
          table_style = pick(section['table_style'], TABLE_STYLES, 'one_line')
          time_format = pick(section['time_format'], TIME_FORMATS, 'datetime')
          result = []

          data[:meta].each do |row|
            next if row[:field] && enabled && !enabled.include?(row[:field])

            custom = row[:field] ? clip(text_of(labels[row[:field]]), MAX_LABEL_LENGTH) : ''
            label = "#{custom.empty? ? row[:label] : custom}#{row[:label_suffix]}"
            if row[:field] == 'table' && table_style == 'two_lines' && data[:table]
              result << { 'label' => data[:table][:area_label], 'value' => data[:table][:area] } if data[:table][:area]
              result << { 'label' => label, 'value' => data[:table][:name] }
              next
            end

            value = if row[:field] && TIME_FIELDS.include?(row[:field]) && time_format == 'date' && row[:date_value]
                      row[:date_value]
                    else
                      row[:value]
                    end
            next if Text.trim(value.to_s).empty?

            printed = { 'label' => label, 'value' => value }
            result << (row[:strong] ? printed.merge('strong' => true) : printed)
          end
          result
        end

        def line_name(line, columns)
          columns.include?('sku') && line[:sku] ? "#{line[:name]} (#{line[:sku]})" : line[:name]
        end

        def quantity_text(line, columns)
          "#{line[:quantity]}#{columns.include?('unit') && line[:unit] ? " #{line[:unit]}" : ''}"
        end

        def timed_note(line, section)
          summary = line[:timed_summary]
          return [] unless summary

          [section['timed_style'] == 'duration' ? summary[:duration] : summary[:range]]
        end

        def line_details(line, columns, section)
          details = []
          unless line[:price].nil?
            parts = [columns.include?('qty') ? quantity_text(line, columns) : '', columns.include?('price') ? line[:price] : ''].reject(&:empty?)
            details << parts.join(' × ') if parts.any?
          end
          details << line[:conversion] if section['show_conversion'] != false && line[:conversion]
          details << line[:discount_note] if columns.include?('discount') && line[:discount_note]
          details << line[:barcode_text] if columns.include?('barcode') && line[:barcode_text]
          details.concat(line[:trace]) if section['show_trace'] != false
          details.concat(timed_note(line, section))
          details.concat(line[:notes])
          details << line[:line_note] if columns.include?('note') && line[:line_note]
          details
        end

        def lines(data, section)
          section = {} unless section.is_a?(Hash)
          columns = section['columns'].is_a?(Array) ? section['columns'] & ALL_COLUMNS : ALL_COLUMNS
          ruling = pick_optional(section['ruling'], LINE_RULINGS)
          index = ->(position) { columns.include?('index') ? position + 1 : nil }
          return table_lines(data, section, columns, ruling, index) if section['layout'] == 'table'

          result = { 'layout' => 'stacked' }
          result['ruling'] = ruling if ruling
          result['items'] = data[:lines].each_with_index.map do |line, position|
            item = { 'index' => index[position], 'name' => line_name(line, columns),
                     'amount' => columns.include?('amount') ? line[:amount] : nil }
            item['originalPrice'] = line[:original_price] if columns.include?('original_price') && line[:original_price]
            item['details'] = line_details(line, columns, section)
            item
          end
          result
        end

        def table_lines(data, section, columns, ruling, index)
          keys = TABLE_COLUMNS.select { |key| columns.include?(key) }
          result = { 'layout' => 'table' }
          result['ruling'] = ruling if ruling
          result.merge(
            'headings' => { 'index' => columns.include?('index') ? data[:line_labels][:index] : nil, 'name' => data[:line_labels][:name] },
            'columns' => keys.map { |key| { 'key' => key, 'label' => data[:line_labels][key.to_sym] } },
            'rows' => data[:lines].each_with_index.map do |line, position|
              row = { 'index' => index[position], 'name' => line_name(line, columns),
                      'cells' => keys.map { |key| table_cell(line, key, columns) } }
              row['originalPrice'] = line[:original_price_cell] if columns.include?('original_price') && line[:original_price_cell]
              row['details'] = [
                *(section['show_conversion'] && line[:conversion] ? [line[:conversion]] : []),
                *(columns.include?('barcode') && line[:barcode_text] ? [line[:barcode_text]] : []),
                *(section['show_trace'] ? line[:trace] : []),
                *timed_note(line, section),
                *line[:notes],
                *(columns.include?('note') && line[:line_note] ? [line[:line_note]] : [])
              ]
              row
            end
          )
        end

        def table_cell(line, key, columns)
          case key
          when 'qty' then quantity_text(line, columns)
          when 'price' then line[:price_cell]
          when 'discount' then line[:discount_cell]
          else line[:amount_cell]
          end
        end

        def with_qr_style(base, section)
          section = {} unless section.is_a?(Hash)
          size = pick_optional(section['qr_size'], QR_SIZES)
          caption_pos = pick_optional(section['qr_caption'], QR_CAPTIONS)
          result = base.dup
          result['size'] = size if size
          result['captionPosition'] = caption_pos if caption_pos
          result
        end

        def pay_qr(data, section)
          qr = data[:pay_qr]
          return nil unless qr

          section = {} unless section.is_a?(Hash)
          return nil if section['fields'].is_a?(Array) && !section['fields'].include?('pay_qr')

          custom = clip(text_of((section['labels'].is_a?(Hash) ? section['labels'] : {})['pay_qr']), MAX_LABEL_LENGTH)
          with_qr_style({ 'value' => qr[:value], 'caption' => custom.empty? ? qr[:caption] : custom, 'lines' => qr[:lines] }, section)
        end

        def transfer_qr(data, section)
          qr = data[:transfer_qr]
          return nil unless qr && section.is_a?(Hash) && section['fields'].is_a?(Array) && section['fields'].include?('transfer_qr')

          custom = clip(text_of((section['labels'].is_a?(Hash) ? section['labels'] : {})['transfer_qr']), MAX_LABEL_LENGTH)
          with_qr_style({ 'value' => qr[:value], 'caption' => custom.empty? ? qr[:caption] : custom, 'lines' => qr[:lines] }, section)
        end

        def einvoice_section(data, section)
          return nil unless section.is_a?(Hash) && section['fields'].is_a?(Array) && section['fields'].any? && data[:einvoice_section]

          rows = field_rows(data[:einvoice_section][:rows], section)
          labels = section['labels'].is_a?(Hash) ? section['labels'] : {}
          raw_qr = data[:einvoice_section][:qr]
          qr = if section['fields'].include?('qr') && raw_qr && web_url?(raw_qr[:value].to_s)
                 custom = clip(text_of(labels['qr']), MAX_LABEL_LENGTH)
                 with_qr_style({ 'value' => raw_qr[:value], 'caption' => custom.empty? ? raw_qr[:caption] : custom, 'lines' => raw_qr[:lines] }, section)
               end
          return nil if rows.empty? && qr.nil?

          { 'rows' => rows, 'qr' => qr }
        end
      end
    end
  end
end
