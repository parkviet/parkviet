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
