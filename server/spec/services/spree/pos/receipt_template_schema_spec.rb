# frozen_string_literal: true

RSpec.describe Spree::Pos::ReceiptTemplateSchema do
  def config_for(type, paper: Spree::Pos::ReceiptTemplate::DEFAULT_PAPER)
    Spree::Pos::ReceiptTemplate.default_config(type, paper: paper)
  end

  def errors_of(config, type = 'sale')
    described_class.validate(config, type)
  end

  def pointers(config, type = 'sale')
    errors_of(config, type).map { |error| error[:pointer] }
  end

  it 'accepts every built-in default template on every paper of its type' do
    Spree::Pos::ReceiptTemplate::DOCUMENT_TYPES.each do |type|
      Spree::Pos::ReceiptTemplate.papers_for(type).each do |paper|
        expect(errors_of(config_for(type, paper: paper), type)).to eq([]), "#{type} (#{paper})"
      end
    end
  end

  it 'accepts every block, field and variable the schema lists' do
    config = config_for('sale')
    config['page']['margins'] = { 'top' => 0, 'right' => 15, 'bottom' => 4.5, 'left' => 2 }
    config['page']['cut_feed_mm'] = 10
    config['header'] = [
      { 'type' => 'logo', 'width_pct' => 40, 'align' => 'left' },
      { 'type' => 'business', 'fields' => described_class::BUSINESS_FIELDS, 'align' => 'right' },
      { 'type' => 'title', 'label' => 'HÓA ĐƠN', 'size' => 'xl' },
      { 'type' => 'divider', 'style' => 'solid' },
      { 'type' => 'spacer', 'mm' => 4 }
    ]
    config['meta'] = {
      'fields' => described_class::META_ALL,
      'labels' => { 'time' => 'Ngày', 'table' => 'Bàn' },
      'table_style' => 'two_lines',
      'time_format' => 'date'
    }
    config['lines'] = {
      'layout' => 'table',
      'columns' => described_class::COLUMNS_ALL,
      'show_trace' => true,
      'show_conversion' => true,
      'ruling' => 'grid',
      'timed_style' => 'range'
    }
    config['totals'] = { 'fields' => described_class::TOTALS_ALL, 'labels' => { 'item_count' => 'SL' } }
    config['payments'] = {
      'fields' => described_class::PAYMENTS_ALL,
      'labels' => { 'debt' => 'Còn nợ', 'transfer_qr' => 'Quét QR' },
      'qr_size' => 'l',
      'qr_caption' => 'left'
    }
    config['einvoice'] = {
      'fields' => described_class::EINVOICE_ALL,
      'labels' => { 'qr' => 'Tra cứu HĐĐT' },
      'qr_size' => 's',
      'qr_caption' => 'above'
    }
    config['footer'] = [{ 'type' => 'text', 'value' => described_class::VARIABLES.map { |name| "{#{name}}" }.join(' '),
                          'bold' => true, 'size' => 'l', 'align' => 'center' }]
    expect(errors_of(config)).to eq([])
  end

  it 'points at unknown blocks, keys and variables' do
    config = config_for('sale')
    config['header'] << { 'type' => 'html', 'value' => '<b>x</b>' }
    html = config['header'].size - 1
    config['footer'] = [
      { 'type' => 'text', 'value' => 'Hotline {store.phone} {store.secret}' },
      { 'type' => 'divider', 'style' => 'dotted', 'color' => 'red' }
    ]
    config['extra'] = true
    errors = errors_of(config)
    expect(errors).to include(
      { pointer: "/config/header/#{html}/type", code: 'unknown_block', message: 'Block type "html" is not supported.' },
      { pointer: '/config/footer/0/value', code: 'unknown_variable', message: '{store.secret} is not a known variable.' },
      hash_including(pointer: '/config/footer/1/style', code: 'invalid_value'),
      hash_including(pointer: '/config/footer/1/color', code: 'unknown_key'),
      hash_including(pointer: '/config/extra', code: 'unknown_key')
    )
  end

  it 'enforces lengths, block counts, ranges and the config size' do
    config = config_for('sale')
    config['footer'] = [{ 'type' => 'text', 'value' => 'x' * 501 }]
    config['header'] = [{ 'type' => 'title', 'label' => 't' * 61 }]
    config['totals']['labels'] = { 'discount' => 'l' * 41 }
    config['page']['line_spacing'] = 2
    expect(pointers(config)).to contain_exactly('/config/footer/0/value', '/config/header/0/label',
                                                '/config/totals/labels/discount', '/config/page/line_spacing')

    crowded = config_for('sale')
    crowded['footer'] = Array.new(9) { { 'type' => 'spacer' } }
    expect(errors_of(crowded)).to eq([{ pointer: '/config/footer', code: 'too_many', message: 'footer may have at most 8 blocks.' }])

    huge = config_for('sale')
    huge['footer'] = Array.new(8) { { 'type' => 'text', 'value' => 'é' * 500 } }
    huge['header'] = Array.new(8) { { 'type' => 'text', 'value' => 'é' * 500 } }
    expect(errors_of(huge).map { |error| error[:code] }).to eq(['too_large'])
  end

  it 'validates 4-side margins, cut_feed_mm, title size, section options and einvoice availability' do
    bad = config_for('sale')
    bad['page']['margins'] = { 'top' => -1, 'right' => 16, 'bottom' => 0, 'extra' => 1 }
    bad['page']['cut_feed_mm'] = 35
    bad['header'] = [{ 'type' => 'title', 'size' => 'xxl' }]
    bad['meta']['table_style'] = 'three_lines'
    bad['meta']['time_format'] = 'clock'
    bad['lines']['ruling'] = 'dotted'
    bad['lines']['timed_style'] = 'seconds'
    bad['payments']['qr_size'] = 'xl'
    bad['payments']['qr_caption'] = 'inside'
    bad['einvoice'] = { 'fields' => %w[qr bogus], 'qr_size' => 'xs', 'qr_caption' => 'diagonal' }
    expect(errors_of(bad).map { |e| [e[:pointer], e[:code]] }).to contain_exactly(
      ['/config/page/margins/extra', 'unknown_key'],
      ['/config/page/margins/top', 'invalid_value'],
      ['/config/page/margins/right', 'invalid_value'],
      ['/config/page/margins/left', 'missing'],
      ['/config/page/cut_feed_mm', 'invalid_value'],
      ['/config/header/0/size', 'invalid_value'],
      ['/config/meta/table_style', 'invalid_value'],
      ['/config/meta/time_format', 'invalid_value'],
      ['/config/lines/ruling', 'invalid_value'],
      ['/config/lines/timed_style', 'invalid_value'],
      ['/config/payments/qr_size', 'invalid_value'],
      ['/config/payments/qr_caption', 'invalid_value'],
      ['/config/einvoice/fields/1', 'field_unavailable'],
      ['/config/einvoice/qr_size', 'invalid_value'],
      ['/config/einvoice/qr_caption', 'invalid_value']
    )

    non_hash_margins = config_for('sale')
    non_hash_margins['page']['margins'] = 5
    expect(errors_of(non_hash_margins).map { |e| [e[:pointer], e[:code]] }).to eq([['/config/page/margins', 'invalid_type']])
  end

  it 'accepts a field only for document types that carry its data' do
    closure = config_for('shift_closure')
    closure['lines'] = config_for('sale')['lines']
    closure['meta']['fields'] = %w[time customer]
    expect(errors_of(closure, 'shift_closure')).to contain_exactly(
      hash_including(pointer: '/config/lines', code: 'section_unavailable'),
      hash_including(pointer: '/config/meta/fields/1', code: 'field_unavailable')
    )

    prebill = config_for('prebill')
    prebill['totals']['fields'] << 'tax'
    prebill['payments']['labels'] = { 'debt' => 'Nợ' }
    prebill['einvoice'] = { 'fields' => ['qr'] }
    expect(pointers(prebill, 'prebill')).to contain_exactly(
      "/config/totals/fields/#{prebill['totals']['fields'].length - 1}",
      '/config/payments/labels/debt',
      '/config/einvoice'
    )

    ticket = config_for('payment_ticket')
    ticket['payments']['fields'] << 'customer_debt'
    ticket['einvoice'] = { 'fields' => ['qr'] }
    expect(errors_of(ticket, 'payment_ticket').map { |e| [e[:pointer], e[:code]] }).to contain_exactly(
      ["/config/payments/fields/#{ticket['payments']['fields'].length - 1}", 'field_unavailable'],
      ['/config/einvoice', 'section_unavailable']
    )

    ret = config_for('return')
    ret['meta']['fields'] = %w[time printed_at print_count order_source table]
    ret['lines']['columns'] = %w[name amount note barcode]
    expect(errors_of(ret, 'return').map { |e| [e[:pointer], e[:code]] }).to contain_exactly(
      ['/config/meta/fields/4', 'field_unavailable'],
      ['/config/lines/columns/3', 'field_unavailable']
    )
  end

  it 'keeps the title in the header once and payment method labels fixed' do
    config = config_for('sale')
    config['header'] << { 'type' => 'title' }
    title = config['header'].size - 1
    config['footer'] = [{ 'type' => 'title' }]
    config['payments']['labels'] = { 'methods' => 'Thanh toán' }
    expect(errors_of(config).map { |error| [error[:pointer], error[:code]] }).to contain_exactly(
      ["/config/header/#{title}", 'duplicate'], ['/config/footer/0', 'misplaced'], ['/config/payments/labels/methods', 'field_unavailable']
    )
  end

  it 'rejects malformed shapes without raising' do
    expect(errors_of('nope')).to eq([{ pointer: '/config', code: 'invalid_type', message: 'Config must be an object.' }])
    expect(pointers({ 'schema' => 2, 'page' => [], 'header' => {}, 'footer' => [nil] })).to contain_exactly(
      '/config/schema', '/config/page', '/config/header', '/config/footer/0'
    )
    expect(pointers({ 'schema' => 1 })).to contain_exactly('/config/page', '/config/header', '/config/footer')
    duplicated = config_for('sale')
    duplicated['meta']['fields'] = %w[time time]
    expect(errors_of(duplicated)).to eq([{ pointer: '/config/meta/fields/1', code: 'duplicate', message: 'time is listed twice.' }])
  end

  it 'accepts QR codes, barcodes, signatures, a monochrome logo and sale copies' do
    config = config_for('sale')
    config['page']['copies'] = 3
    config['header'].unshift({ 'type' => 'logo', 'width_pct' => 50, 'monochrome' => true })
    config['footer'] = [
      { 'type' => 'qr', 'source' => 'url', 'value' => 'http://example.vn/review?id=1', 'caption' => 'Đánh giá', 'align' => 'right' },
      *described_class::SOCIAL_FIELDS.map { |field| { 'type' => 'qr', 'source' => 'store_social', 'field' => field } },
      { 'type' => 'barcode', 'align' => 'left' },
      { 'type' => 'signatures', 'parties' => described_class::SIGNATURE_PARTIES, 'labels' => { 'buyer' => 'Khách hàng' } }
    ]
    expect(errors_of(config)).to eq([])
  end

  it 'refuses QR links that are not http(s) and malformed QR or signature blocks' do
    config = config_for('sale')
    config['footer'] = [
      { 'type' => 'qr', 'source' => 'url', 'value' => 'javascript:alert(1)' },
      { 'type' => 'qr', 'source' => 'url', 'value' => "https://#{'a' * 300}.vn" },
      { 'type' => 'qr', 'source' => 'url', 'field' => 'url', 'value' => 'ftp://example.vn' },
      { 'type' => 'qr', 'source' => 'store_social', 'field' => 'zalo', 'value' => 'https://x.vn' },
      { 'type' => 'qr', 'source' => 'vietqr_payment' },
      { 'type' => 'signatures', 'parties' => [], 'labels' => { 'boss' => 'x' } },
      { 'type' => 'logo', 'monochrome' => 'yes' },
      { 'type' => 'barcode', 'value' => 'R1' }
    ]
    expect(errors_of(config).map { |error| [error[:pointer], error[:code]] }).to contain_exactly(
      ['/config/footer/0/value', 'invalid_url'], ['/config/footer/1/value', 'too_long'],
      ['/config/footer/2/field', 'unknown_key'], ['/config/footer/2/value', 'invalid_url'],
      ['/config/footer/3/value', 'unknown_key'], ['/config/footer/3/field', 'invalid_value'],
      ['/config/footer/4/source', 'invalid_value'],
      ['/config/footer/5/parties', 'blank'], ['/config/footer/5/labels/boss', 'unknown_key'],
      ['/config/footer/6/monochrome', 'invalid_type'], ['/config/footer/7/value', 'unknown_key']
    )
    malformed = config_for('sale')
    malformed['footer'] = ['http:example.com', 'https:/example.com', 'https://cửahàng.vn', 'https://shop.vn/đổi-trả',
                           'https://shop.vn/%zz', 'https://shop.vn/{id}'].map { |link| { 'type' => 'qr', 'source' => 'url', 'value' => link } }
    expect(errors_of(malformed).map { |error| error[:code] }).to eq(['invalid_url'] * 6)
    good = config_for('sale')
    good['footer'] = [{ 'type' => 'qr', 'source' => 'url', 'value' => 'https://shop.vn:8443/a/b?x=1&y=%C3%A1#top' }]
    expect(errors_of(good)).to eq([])

    missing = config_for('sale')
    missing['footer'] = [{ 'type' => 'qr', 'source' => 'url' }, { 'type' => 'qr' }, { 'type' => 'qr', 'source' => 'store_social' }]
    expect(pointers(missing)).to contain_exactly('/config/footer/0/value', '/config/footer/1/source', '/config/footer/2/field')
  end

  it 'prints several copies at once only for sale receipts, from one to three' do
    sale = config_for('sale')
    sale['page']['copies'] = 4
    expect(errors_of(sale)).to eq([{ pointer: '/config/page/copies', code: 'invalid_value', message: 'copies must be a whole number from 1 to 3.' }])
    sale['page']['copies'] = 1.5
    expect(pointers(sale)).to eq(['/config/page/copies'])
    refund = config_for('refund')
    refund['page']['copies'] = 2
    expect(errors_of(refund, 'refund').map { |error| error[:code] }).to eq(['field_unavailable'])
  end

  it 'raises the errors from validate!' do
    expect { described_class.validate!({ 'schema' => 1 }, 'sale') }.to raise_error(described_class::Invalid) { |error|
      expect(error.errors.length).to eq(3)
      expect(error.message).to eq('page is required.')
    }
  end
end
