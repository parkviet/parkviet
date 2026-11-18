# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_shift_helpers'

# What the POS goods screens read beside the core product endpoints: the
# product list searched by barcode and narrowed to what a channel lacks, every
# listed variant's unit at once, and the branches one product is sold at.
RSpec.describe 'POS goods catalog reads', type: :request do
  include PosShiftHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:pos_channel) { store.channels.find_by(code: 'pos') || create(:channel, store: store, code: 'pos', name: 'POS') }
  let(:catalog) { credit_staff(store, branch, [], extra_permissions: %w[read_products write_products]) }
  let(:admin) { credit_staff(store, branch, [], extra_permissions: %w[read_pos_topology write_pos_topology read_products]) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD) }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def call(user, path, params = {})
    get "/api/v3/admin/#{path}", headers: { 'Authorization' => "Bearer #{token_for(user)}" }, params: params
    response.parsed_body
  end

  def product_named(name, sku:, barcode:)
    product = create(:product, store: store, status: 'active', name: name)
    product.default_variant.update!(sku: sku, barcode: barcode)
    product
  end

  describe 'product list scopes' do
    let!(:rice) { product_named('Gạo thơm', sku: 'SP000001', barcode: '8934567000011') }
    let!(:milk) { product_named('Sữa tươi', sku: 'SP000002', barcode: '1') }

    it 'finds products by name, SKU or barcode, keeping a numeric term as typed' do
      ids = ->(term) { call(catalog, 'products', { q: { search_with_barcode: term } })['data'].map { |row| row['id'] } }

      expect(ids.call('gạo')).to eq([rice.prefixed_id])
      expect(ids.call('SP000002')).to eq([milk.prefixed_id])
      expect(ids.call('8934567')).to eq([rice.prefixed_id])
      expect(ids.call('1')).to contain_exactly(rice.prefixed_id, milk.prefixed_id)
      # Ransack drops a blank term before the scope, so the list stays unfiltered.
      expect(ids.call('  ')).to include(rice.prefixed_id, milk.prefixed_id)
    end

    it 'lists the products a channel does not carry, even when another channel does' do
      online = create(:channel, store: store, code: "web#{SecureRandom.hex(2)}", name: 'Web')
      Spree::ProductPublication.create!(product: rice, channel: pos_channel)
      Spree::ProductPublication.create!(product: milk, channel: online)

      missing = call(catalog, 'products', { q: { not_in_channel: 'pos' } })['data'].map { |row| row['id'] }
      expect(missing).to include(milk.prefixed_id)
      expect(missing).not_to include(rice.prefixed_id)
    end
  end

  describe 'variant units' do
    let(:product) { product_named('Bia lon', sku: 'SP000003', barcode: '893000000003') }
    let(:plain) { product_named('Khăn giấy', sku: 'SP000004', barcode: '893000000004') }
    let(:foreign) { create(:product, store: create(:store, default_currency: 'VND', supported_currencies: 'VND')) }

    before do
      Spree::Pos::UnitDefinition.ensure_defaults!(store)
      can = Spree::Pos::UnitDefinition.create!(store: store, code: 'lon', name: 'Lon', dimension: 'count', base_code: 'lon',
                                               factor_to_base: 1, sale_precision: 0, status: 'active', version: 1)
      Spree::Pos::VariantUnit.create!(store: store, variant: product.default_variant, sale_unit: can, base_unit: can, price_unit: can,
                                      ratio_numerator: 1, ratio_denominator: 1, tracked_mode: 'none', status: 'active', version: 1)
    end

    it "reads each listed variant's unit for catalog readers, defaulting to the item unit" do
      ids = [product.default_variant, plain.default_variant, foreign.default_variant].map(&:prefixed_id) + [product.prefixed_id]
      data = call(catalog, 'pos/units/variants', { variant_ids: ids.join(',') })['data']

      expect(response).to have_http_status(:ok)
      expect(data.to_h { |row| [row['variant_id'], [row['sale_unit'], row['sale_unit_name'], row['status']]] }).to eq(
        product.default_variant.prefixed_id => %w[lon Lon active],
        plain.default_variant.prefixed_id => [ 'item', Spree::Pos::UnitDefinition.find_by!(store: store, code: 'item').name, 'default' ]
      )
    end

    it 'lists store units for catalog readers and refuses cashiers without catalog or topology keys' do
      expect(call(catalog, 'pos/units')['data'].map { |row| row['code'] }).to include('item', 'lon')

      call(cashier, 'pos/units/variants', { variant_ids: product.default_variant.prefixed_id })
      expect(response).to have_http_status(:forbidden)
    end

    it 'refuses more variants than one page' do
      call(catalog, 'pos/units/variants', { variant_ids: Array.new(101) { |i| "variant_#{i}" }.join(',') })
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  it 'answers whether each branch sells one product' do
    pos_channel
    product = product_named('Nước suối', sku: 'SP000005', barcode: '893000000005')
    other = product_named('Nước ngọt', sku: 'SP000006', barcode: '893000000006')
    [product, other].each { |row| Spree::ProductPublication.create!(product: row, channel: pos_channel) }
    Spree::Pos::BranchProduct.create!(branch: branch, product: product)

    rows = call(admin, "pos/branches/#{branch.prefixed_id}/products", { product_id: product.prefixed_id })['data']
    expect(rows.map { |row| [row['id'], row['assigned']] }).to eq([[product.prefixed_id, true]])
    expect(call(admin, "pos/branches/#{branch.prefixed_id}/products", { product_id: 'prod_missing' })['data']).to eq([])
  end
end
