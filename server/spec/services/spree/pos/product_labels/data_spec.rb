# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_shift_helpers'

RSpec.describe Spree::Pos::ProductLabels::Data do
  include PosShiftHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:pos_channel) { store.channels.find_by(code: 'pos') || create(:channel, store: store, code: 'pos', name: 'POS') }

  before do
    allow(Spree::Store).to receive(:default).and_return(store)
    pos_channel
  end

  def sold_product(name: 'Gạo thơm', price: 45_000, barcode: '8934567000011', sku: 'SP000001', assign: true)
    product = create(:product, store: store, status: 'active', name: name)
    variant = product.default_variant
    variant.update!(sku: sku, barcode: barcode)
    variant.set_price('VND', price)
    Spree::ProductPublication.find_or_create_by!(product: product, channel: pos_channel)
    Spree::Pos::BranchProduct.create!(branch: branch, product: product) if assign
    product
  end

  def build(items)
    described_class.call(store: store, branch: branch, items: items)
  end

  it 'returns the code, unit, list price and the store header for each line' do
    product = sold_product
    result = build([{ variant_id: product.default_variant.prefixed_id, quantity: 3 }])

    row = result[:data].first
    expect(row).to include(
      variant_id: product.default_variant.prefixed_id, product_name: 'Gạo thơm', sku: 'SP000001', barcode: '8934567000011',
      unit: 'Cái', price: '45000.0', original_price: nil, currency: 'VND', quantity: 3, warnings: []
    )
    expect(result[:store]).to include(:name, :address)
  end

  it 'reports a missing code, a missing price and an item the branch does not sell' do
    product = sold_product(barcode: nil, sku: '', price: 0, assign: false)
    row = build([{ variant_id: product.default_variant.prefixed_id, quantity: 1 }])[:data].first

    expect(row[:price]).to be_nil
    expect(row[:warnings]).to contain_exactly('no_code', 'no_price', 'not_sold_in_branch')
  end

  it 'prints a compare-at price only when it is higher than the price' do
    higher = sold_product(name: 'A', sku: 'A1', barcode: nil)
    equal = sold_product(name: 'B', sku: 'B1', barcode: nil)
    higher.default_variant.prices.find_by(currency: 'VND').update!(compare_at_amount: 60_000)
    equal.default_variant.prices.find_by(currency: 'VND').update!(compare_at_amount: 45_000)

    rows = build([{ variant_id: higher.default_variant.prefixed_id, quantity: 1 },
                  { variant_id: equal.default_variant.prefixed_id, quantity: 1 }])[:data]

    expect(rows.map { |row| row[:original_price] }).to eq(['60000.0', nil])
  end

  it 'uses the configured sale unit and refuses another unit' do
    product = sold_product
    variant = product.default_variant
    Spree::Pos::UnitDefinition.ensure_defaults!(store)
    pack = Spree::Pos::UnitDefinition.find_by!(store: store, code: 'pack')
    Spree::Pos::VariantUnit.create!(store: store, variant: variant, sale_unit: pack, base_unit: pack, price_unit: pack,
                                    ratio_numerator: 1, ratio_denominator: 1, tracked_mode: 'none', version: 1, status: 'active')

    row = build([{ variant_id: variant.prefixed_id, unit_id: pack.prefixed_id, quantity: 1 }])[:data].first
    expect(row[:unit]).to eq(pack.name)

    item = Spree::Pos::UnitDefinition.find_by!(store: store, code: 'item')
    expect { build([{ variant_id: variant.prefixed_id, unit_id: item.prefixed_id, quantity: 1 }]) }
      .to raise_error(described_class::Invalid) { |error| expect(error.errors.first[:pointer]).to eq('/items/0/unit_id') }
  end

  it 'joins the option values of a variant' do
    product = sold_product
    color = create(:option_type, name: "color-#{SecureRandom.hex(2)}", presentation: 'Màu')
    size = create(:option_type, name: "size-#{SecureRandom.hex(2)}", presentation: 'Cỡ')
    red = create(:option_value, option_type: color, name: 'red', presentation: 'Đỏ')
    large = create(:option_value, option_type: size, name: 'l', presentation: 'L')
    variant = create(:variant, product: product, option_values: [red, large])
    variant.set_price('VND', 50_000)

    row = build([{ variant_id: variant.prefixed_id, quantity: 1 }])[:data].first
    expect(row[:variant_options].split(' / ')).to contain_exactly('Đỏ', 'L')
  end

  it 'refuses a variant of another store as not found' do
    other = create(:store)
    foreign = create(:product, store: other).default_variant

    expect { build([{ variant_id: foreign.prefixed_id, quantity: 1 }]) }
      .to raise_error(described_class::Invalid) { |error| expect(error.errors.first[:code]).to eq('not_found') }
  end

  it 'enforces the item, quantity and total label limits' do
    id = sold_product.default_variant.prefixed_id
    codes = lambda do |items|
      build(items)
    rescue described_class::Invalid => e
      e.errors.first[:code]
    end

    expect(codes.call([])).to eq('required')
    expect(codes.call(Array.new(201) { { variant_id: id, quantity: 1 } })).to eq('too_many')
    expect(codes.call([{ variant_id: id, quantity: 0 }])).to eq('out_of_range')
    expect(codes.call([{ variant_id: id, quantity: 1000 }])).to eq('out_of_range')
    expect(codes.call(Array.new(3) { { variant_id: id, quantity: 999 } })).to eq('too_many_labels')
    expect(codes.call(Array.new(2) { { variant_id: id, quantity: 999 } })).to be_a(Hash)
  end
end
