# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_shift_helpers'

RSpec.describe 'POS product label data', type: :request do
  include PosShiftHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:pos_channel) { store.channels.find_by(code: 'pos') || create(:channel, store: store, code: 'pos', name: 'POS') }
  let(:reader) { credit_staff(store, branch, [], extra_permissions: %w[read_products]) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD) }
  let(:path) { "/api/v3/admin/pos/branches/#{branch.prefixed_id}/product_labels/data" }

  before do
    allow(Spree::Store).to receive(:default).and_return(store)
    pos_channel
  end

  def token_for(user)
    post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
    response.parsed_body.fetch('token')
  end

  def call(user, items)
    post path, headers: { 'Authorization' => "Bearer #{token_for(user)}" }, params: { items: items }, as: :json
    response.parsed_body
  end

  def sold_variant(sku: 'SP1', barcode: '8934567000011')
    product = create(:product, store: store, status: 'active', name: 'Sữa tươi')
    product.default_variant.update!(sku: sku, barcode: barcode)
    product.default_variant.set_price('VND', 30_000)
    Spree::ProductPublication.find_or_create_by!(product: product, channel: pos_channel)
    Spree::Pos::BranchProduct.create!(branch: branch, product: product)
    product.default_variant
  end

  it 'returns label rows and the store header to a goods reader' do
    variant = sold_variant
    body = call(reader, [{ variant_id: variant.prefixed_id, quantity: 2 }])

    expect(response).to have_http_status(:ok)
    expect(body['data'].first).to include('product_name' => 'Sữa tươi', 'barcode' => '8934567000011', 'price' => '30000.0',
                                          'quantity' => 2, 'warnings' => [])
    expect(body['store']).to include('name', 'address')
  end

  it 'refuses staff without a goods or topology permission' do
    call(cashier, [{ variant_id: sold_variant.prefixed_id, quantity: 1 }])

    expect(response).to have_http_status(:forbidden)
  end

  it 'rejects a variant of another store with a field error' do
    foreign = create(:product, store: create(:store)).default_variant
    body = call(reader, [{ variant_id: foreign.prefixed_id, quantity: 1 }])

    expect(response).to have_http_status(:unprocessable_content)
    expect(body.dig('error', 'details', 'errors', 0, 'pointer')).to eq('/items/0/variant_id')
  end

  it 'rejects more than 200 items' do
    id = sold_variant.prefixed_id
    call(reader, Array.new(201) { { variant_id: id, quantity: 1 } })

    expect(response).to have_http_status(:unprocessable_content)
  end

  it 'does not find a branch of another store' do
    other_branch = credit_branch(create(:store))
    post "/api/v3/admin/pos/branches/#{other_branch.prefixed_id}/product_labels/data",
         headers: { 'Authorization' => "Bearer #{token_for(reader)}" }, params: { items: [] }, as: :json

    expect(response).to have_http_status(:not_found)
  end

  describe 'print' do
    let(:print_path) { "/api/v3/admin/pos/branches/#{branch.prefixed_id}/product_labels/print" }
    let(:station) do
      Spree::Pos::Device.create!(store: store, branch: branch, name: 'Trạm in', mode: 'print_station', platform: 'android',
                                 token_digest: Spree::Pos::Device.digest(Spree::Pos::Device.new_token))
    end
    let(:label_printer) do
      Spree::Pos::Printer.create!(store: store, branch: branch, name: 'Tem', connection: 'sunmi_builtin', paper: '58mm',
                                  command_language: 'tspl', roles: ['product_label'], print_station_device: station)
    end

    def template(paper)
      Spree::Pos::ReceiptTemplate.ensure_defaults!(store)
      Spree::Pos::ReceiptTemplate.for_store(store).find_by!(document_type: 'product_label', paper: paper)
    end

    def print_labels(user, items, template:, printer: label_printer, key: SecureRandom.uuid)
      headers = { 'Authorization' => "Bearer #{token_for(user)}" }
      headers['Idempotency-Key'] = key if key
      post print_path, headers: headers, as: :json,
                       params: { template_id: template.prefixed_id, printer_id: printer.prefixed_id, items: items }
      response.parsed_body
    end

    it 'queues a label job with the rows the template shows' do
      variant = sold_variant(barcode: '8934563138165')
      body = print_labels(reader, [{ variant_id: variant.prefixed_id, quantity: 3 }], template: template('roll_50x30'))

      expect(response).to have_http_status(:created)
      job = Spree::Pos::PrintJob.find_by!(printer: label_printer)
      expect(body.dig('data', 'print_jobs').map { |row| row['kind'] }).to eq(['product_label'])
      expect(job.document.dig('page', 'label')).to include('width_mm' => 50, 'height_mm' => 30, 'columns' => 1)
      label = job.document['labels'].first
      expect(label['copies']).to eq(3)
      expect(label['rows']).to include({ 'kind' => 'barcode', 'symbology' => 'ean13', 'value' => '8934563138165', 'show_text' => true },
                                       { 'kind' => 'price', 'text' => '30.000 ₫' })
    end

    it 'splits more than 2000 labels into several jobs' do
      items = Array.new(3) { |index| { variant_id: sold_variant(sku: "SP-#{index}").prefixed_id, quantity: 999 } }
      body = print_labels(reader, items, template: template('roll_50x30'))

      expect(response).to have_http_status(:created)
      copies = Spree::Pos::PrintJob.where(printer: label_printer).order(:id).map { |job| job.document['labels'].sum { |label| label['copies'] } }
      expect(copies).to eq([2000, 997])
      expect(body.dig('data', 'print_jobs').size).to eq(2)
    end

    it 'queues nothing again for a replayed key' do
      items = [{ variant_id: sold_variant.prefixed_id, quantity: 1 }]
      key = SecureRandom.uuid
      print_labels(reader, items, template: template('roll_50x30'), key: key)
      print_labels(reader, items, template: template('roll_50x30'), key: key)

      expect(Spree::Pos::PrintJob.where(printer: label_printer).count).to eq(1)
    end

    it 'sends a sheet stock back to the browser' do
      body = print_labels(reader, [{ variant_id: sold_variant.prefixed_id, quantity: 1 }], template: template('sheet_a4_65'))

      expect(response).to have_http_status(:unprocessable_content)
      expect(body.dig('error', 'details', 'errors', 0, 'code')).to eq('sheet_needs_browser')
      expect(Spree::Pos::PrintJob.count).to eq(0)
    end

    it 'refuses a printer that is not set up for labels' do
      plain = Spree::Pos::Printer.create!(store: store, branch: branch, name: 'Bếp', connection: 'sunmi_builtin', paper: '58mm',
                                          command_language: 'escpos', roles: ['kitchen_ticket'], print_station_device: station)
      print_labels(reader, [{ variant_id: sold_variant.prefixed_id, quantity: 1 }], template: template('roll_50x30'), printer: plain)

      expect(response).to have_http_status(:conflict)
      expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('printer_wrong_kind')
    end

    it 'requires an idempotency key' do
      print_labels(reader, [{ variant_id: sold_variant.prefixed_id, quantity: 1 }], template: template('roll_50x30'), key: nil)

      expect(response).to have_http_status(:unprocessable_content)
    end

    it 'refuses staff without a goods or topology permission' do
      print_labels(cashier, [{ variant_id: sold_variant.prefixed_id, quantity: 1 }], template: template('roll_50x30'))

      expect(response).to have_http_status(:forbidden)
    end

    it 'rejects a variant of another store with a field error' do
      foreign = create(:product, store: create(:store)).default_variant
      body = print_labels(reader, [{ variant_id: foreign.prefixed_id, quantity: 1 }], template: template('roll_50x30'))

      expect(response).to have_http_status(:unprocessable_content)
      expect(body.dig('error', 'details', 'errors', 0, 'pointer')).to eq('/items/0/variant_id')
    end
  end
end
