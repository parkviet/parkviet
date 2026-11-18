# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::TaxProfile, type: :model do
  let(:store) { create(:store) }

  it 'accepts catalog codes, a period and a non-negative area' do
    profile = described_class.new(store: store, declaration_period: 'quarter', tax_authority_code: '79', industry_code: '5610',
                                  business_area_m2: '45.5', legacy_tax_code: '0312345678-001', signer_name: ' Nguyễn Văn A ')
    expect(profile).to be_valid
    expect(profile.signer_name).to eq('Nguyễn Văn A')
  end

  it 'refuses codes outside the catalog, an unknown period, a negative area and a malformed old tax code' do
    profile = described_class.new(store: store, declaration_period: 'year', tax_authority_code: '99', industry_code: '0000',
                                  business_area_m2: '-1', legacy_tax_code: '123')
    expect(profile).not_to be_valid
    expect(profile.errors.attribute_names).to contain_exactly(:declaration_period, :tax_authority_code, :industry_code,
                                                              :business_area_m2, :legacy_tax_code)
    expect(described_class.new(store: store, business_area_m2: 'abc')).not_to be_valid
  end

  it 'keeps one row per store' do
    described_class.create!(store: store)
    expect(described_class.new(store: store)).not_to be_valid
  end

  describe '#readiness' do
    let(:location) { create(:stock_location, store: store) }
    let(:branch) do
      Spree::Pos::Branch.create!(store: store, stock_location: location, name: 'Quầy', code: "q#{SecureRandom.hex(3)}",
                                 timezone: 'Asia/Ho_Chi_Minh', status: 'active')
    end

    it 'lists every required field while nothing is saved' do
      readiness = described_class.new(store: store).readiness(info: nil, head_office: nil)
      expect(readiness).to eq(filled: 0, total: 9, missing: described_class::REQUIRED)
    end

    it 'counts the store details and the head office location code' do
      info = Spree::Pos::StoreInfo.create!(store: store, name: 'Quán Hiền', phone: '0901234567', tax_code: '001234567890',
                                           province_code: '01', ward_code: '00004', street: '1 Lê Lợi', business_day_cutoff: '04:00')
      profile = described_class.new(store: store, declaration_period: 'month', tax_authority_code: '01', business_area_m2: 0,
                                    signer_name: 'Hiền')
      head = Spree::Pos::BranchInfo.create!(store: store, branch: branch, tax_head_office: true)

      expect(profile.readiness(info: info, head_office: head)).
        to eq(filled: 7, total: 9, missing: %w[industry_code head_office_location])
      head.update!(tax_location_code: '00001')
      profile.industry_code = '5610'
      expect(profile.readiness(info: info, head_office: head)).to eq(filled: 9, total: 9, missing: [])
    end
  end
end
