# frozen_string_literal: true

require Rails.root.join('db/migrate/20261116110000_create_spree_pos_store_infos')

RSpec.describe CreateSpreePosStoreInfos, type: :model do
  it 'fills an empty profile list from the single key and leaves the cutoff alone' do
    store = create(:store)
    location = create(:stock_location, store: store)
    profile = Spree::Pos::StoreProfile.create!(store: store, profile_key: 'cafe_tra_sua', profile_version: 1)
    branch = Spree::Pos::Branch.create!(store: store, stock_location: location, name: 'Ca', code: "c#{SecureRandom.hex(3)}",
                                        timezone: 'Asia/Ho_Chi_Minh', status: 'active', business_day_cutoff: '05:30')
    profile.update_columns(profile_key: 'cafe_tra_sua', profile_keys: [])
    branch.update_columns(profile_key: 'cafe_tra_sua', profile_keys: [])

    described_class.new.backfill!

    expect(profile.reload.profile_keys).to eq(['cafe_tra_sua'])
    expect(branch.reload.profile_keys).to eq(['cafe_tra_sua'])
    expect(branch.business_day_cutoff.strftime('%H:%M')).to eq('05:30')
  end
end
