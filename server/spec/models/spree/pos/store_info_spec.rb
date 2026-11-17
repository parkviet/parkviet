# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::StoreInfo, type: :model do
  let(:store) { create(:store, name: 'Spree Shop') }
  let(:location) { create(:stock_location, store: store) }
  let(:branch) do
    Spree::Pos::Branch.create!(store: store, stock_location: location, name: 'Quầy', code: "q#{SecureRandom.hex(3)}",
                               timezone: 'Asia/Ho_Chi_Minh', status: 'active')
  end

  it 'keeps a single profile key in sync with the list' do
    profile = Spree::Pos::StoreProfile.create!(store: store, profile_key: 'khac', profile_version: 1)
    expect(profile.resolved_keys).to eq(['khac'])
    profile.update!(profile_keys: %w[cafe_tra_sua quan_an])
    expect(profile.reload.profile_key).to eq('cafe_tra_sua')
    expect(profile.resolved_keys).to eq(%w[cafe_tra_sua quan_an])
  end

  it 'rejects a ward that is not in the province' do
    info = described_class.new(store: store, name: 'Quán', phone: '0901234567', province_code: '01', ward_code: '99999')
    expect(info).not_to be_valid
    expect(info.errors[:ward_code]).to be_present
  end

  it 'resolves a branch override, then the store, then the ecommerce store' do
    described_class.create!(store: store, name: 'POS', phone: '0901111111', contact_email: 'pos@example.com',
                            province_code: '01', ward_code: '00004', street: '1 Lê Lợi', business_day_cutoff: '05:00')
    Spree::Pos::BranchInfo.create!(store: store, branch: branch, phone: '0902222222')
    view = described_class.effective(branch)
    expect(view[:name]).to include(value: 'POS', source: 'store')
    expect(view[:phone]).to include(value: '0902222222', source: 'branch')
    expect(view[:address][:value]).to include('Ba Đình', 'Hà Nội', 'Việt Nam')
    expect(view[:business_day_cutoff]).to include(value: '05:00', source: 'store')
  end

  it 'prints the ecommerce store until a POS row exists' do
    expect(described_class.printable(branch)).to be_nil
    described_class.create!(store: store, name: 'POS', phone: '0901111111', business_day_cutoff: '04:00')
    expect(described_class.printable(branch)).to include('name' => 'POS', 'contact_phone' => '0901111111')
  end
end
