# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::VnTaxCatalog do
  let(:raw) { YAML.safe_load_file(Rails.root.join(described_class::PATH)) }

  it 'loads a tax office per province and the abbreviated industry list' do
    expect(described_class.errors_for(raw)).to eq([])
    provinces = Spree::Pos::AdminUnits.provinces.pluck(:code)
    expect(described_class.tax_authorities.pluck(:code)).to match_array(provinces)
    expect(described_class.tax_authorities.find { |row| row[:code] == '79' }).to eq(code: '79', name: 'Thuế thành phố Hồ Chí Minh')
    expect(described_class.industries.find { |row| row[:code] == '5610' }).to include(group: 'fnb')
    expect(described_class.industries.pluck(:group).uniq).to match_array(described_class::INDUSTRY_GROUPS)
    expect(described_class.tax_authority?('01')).to be(true)
    expect(described_class.industry?('9999')).to be(false)
  end

  it 'records the basis of each list and that it still needs checking' do
    payload = described_class.as_payload
    expect(payload.keys).to eq(%i[tax_authorities industries])
    payload.each_value do |block|
      expect(block[:basis]).to be_present
      expect(block[:updated_on]).to match(/\A\d{4}-\d{2}-\d{2}\z/)
      expect(block[:verified]).to be(false)
    end
  end

  it 'lists every direct option as a VAT and income tax rate pair per business line' do
    rates = described_class.options('direct', on: Date.new(2026, 11, 18)).to_h do |row|
      [row[:code], [row[:vat_rate], row[:pit_rate]].map { |rate| rate && (rate * 100).to_s('F') }]
    end
    expect(rates).to eq(
      'direct.goods' => ['1.0', '0.5'], 'direct.goods_vat_exempt' => [nil, '0.5'],
      'direct.service' => ['5.0', '2.0'], 'direct.service_vat_exempt' => [nil, '2.0'],
      'direct.production_transport_food' => ['3.0', '1.5'], 'direct.production_transport_food_vat_exempt' => [nil, '1.5'],
      'direct.other' => ['2.0', '1.0'], 'direct.other_vat_exempt' => [nil, '1.0'],
      'direct.digital_rental' => ['5.0', '5.0'], 'direct.digital_rental_vat_exempt' => [nil, '5.0']
    )
  end

  it 'lists the deduction treatments, the 8% reduction ending on 31/12/2026 back to 10%' do
    options = described_class.options('deduction', on: Date.new(2026, 12, 31))
    expect(options.to_h { |row| [row[:code], [row[:kind], row[:vat_rate]]] }).to eq(
      'deduction.exempt' => ['exempt', nil], 'deduction.not_taxed' => ['not_taxed', nil],
      'deduction.vat_0' => ['rate', BigDecimal('0')], 'deduction.vat_5' => ['rate', BigDecimal('0.05')],
      'deduction.vat_8' => ['rate', BigDecimal('0.08')], 'deduction.vat_10' => ['rate', BigDecimal('0.1')]
    )
    reduced = described_class.option('deduction.vat_8')
    expect(described_class.deduction_rate(reduced, on: Date.new(2027, 1, 1))).to eq(BigDecimal('0.1'))
    expect(described_class.options('deduction', on: Date.new(2027, 1, 1)).pluck(:code)).not_to include('deduction.vat_8')
  end

  it 'holds the threshold, the revenue groups, the reduction and the profile defaults' do
    expect(described_class.threshold(on: Date.new(2026, 6, 1))).to include(
      amount: BigDecimal('1000000000'), warning_ratios: [BigDecimal('0.8'), BigDecimal('0.95')], einvoice_registration_days: 30
    )
    groups = described_class.revenue_groups.to_h { |row| [row[:code], row.values_at(:methods, :pit_methods, :pit_income_rate)] }
    expect(groups).to eq(
      'group_1' => [%w[direct], %w[revenue], nil], 'group_2' => [%w[direct], %w[revenue income], BigDecimal('0.15')],
      'group_3' => [%w[direct deduction], %w[income], BigDecimal('0.17')],
      'group_4' => [%w[deduction direct], %w[income], BigDecimal('0.2')]
    )
    service = described_class.option('direct.service')
    expect(described_class.direct_vat_rate(service, on: Date.new(2026, 12, 31), reduce: true)).to eq(BigDecimal('0.04'))
    expect(described_class.direct_vat_rate(service, on: Date.new(2027, 1, 1), reduce: true)).to eq(BigDecimal('0.05'))
    expect(described_class.direct_vat_rate(described_class.option('direct.digital_rental'), on: Date.new(2026, 12, 31), reduce: true)).
      to eq(BigDecimal('0.05'))
    expect(described_class.profile_defaults('fnb', 'direct')).to eq(
      item: 'direct.production_transport_food', service_fee: 'direct.production_transport_food', shipping: 'direct.production_transport_food'
    )
    expect(described_class.profile_defaults('retail', 'direct')).to include(item: 'direct.goods', shipping: 'direct.production_transport_food')
    expect(described_class.profile_defaults('retail', 'deduction', on: Date.new(2027, 1, 1))).to include(item: 'deduction.vat_10')
  end

  it 'reports a rate block that names an unknown option or breaks its own shape' do
    bad = raw.deep_dup
    bad['reductions']['items'].first['applies_to'] << 'direct.mining'
    expect(described_class.errors_for(bad)).to eq(['nq_204_2025 names unknown option direct.mining'])
    bad = raw.deep_dup
    bad['deduction_options']['items'] << { 'code' => 'deduction.vat_7', 'kind' => 'rate', 'name' => 'GTGT 7%', 'vat_rate' => 'x',
                                           'valid_from' => '2026-01-01', 'valid_to' => '2025-01-01' }
    bad['direct_options']['items'].first['code'] = 'goods'
    expect(described_class.errors_for(bad)).to contain_exactly(
      'deduction.vat_7 needs a vat_rate and a rate_name', 'deduction.vat_7 has a bad validity range', 'goods must start with direct.'
    )
  end

  it 'reports a missing list, a repeated code, a nameless item and an unknown group' do
    bad = raw.deep_dup
    bad.delete('tax_authorities')
    bad['industries']['items'] << { 'code' => '5610', 'group' => 'fnb', 'name' => 'Lặp' }
    bad['industries']['items'] << { 'code' => '0001', 'group' => 'mining', 'name' => '' }
    expect(described_class.errors_for(bad)).to contain_exactly(
      'tax_authorities is missing', 'industries repeats 5610', 'industries has an item without a name',
      'industries has an unknown group'
    )
    expect(described_class.errors_for([])).to eq(['catalog must be a mapping'])
  end
end
