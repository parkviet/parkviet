# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::TaxProfiles::Save do
  let(:store) { create(:store) }
  let(:admin) { staff_with(%w[write_pos_topology]) }
  let!(:info) do
    Spree::Pos::StoreInfo.create!(store: store, name: 'Quán Hiền', phone: '0901234567', business_day_cutoff: '04:00')
  end
  let!(:first) { branch_named('Chi nhánh A') }
  let!(:second) { branch_named('Chi nhánh B') }

  def staff_with(permissions)
    user = create(:admin_user, :without_admin_role)
    create(:role_user, user: user, role: create(:role, resource: store, permissions: permissions))
    user
  end

  def branch_named(name)
    location = create(:stock_location, store: store)
    Spree::Pos::Branch.create!(store: store, stock_location: location, name: name, code: "b#{SecureRandom.hex(3)}",
                               timezone: 'Asia/Ho_Chi_Minh', status: 'active')
  end

  def save(attributes = {}, locations: nil, actor: admin)
    described_class.call(store: store, actor: actor, attributes: attributes, locations: locations)
  end

  it 'writes the shared fields to the store information and the rest to the tax profile, audited once' do
    data = save({ 'name' => 'Hộ kinh doanh Hiền', 'tax_code' => '001234567890', 'province_code' => '01', 'ward_code' => '00004',
                  'street' => '1 Lê Lợi', 'declaration_period' => 'quarter', 'tax_authority_code' => '01',
                  'industry_code' => '5630', 'business_area_m2' => '32.50', 'signer_name' => 'Hiền' },
                locations: [{ 'branch_id' => first.prefixed_id, 'tax_location_code' => '00001', 'tax_head_office' => true }])

    expect(info.reload).to have_attributes(name: 'Hộ kinh doanh Hiền', tax_code: '001234567890', ward_name: 'Ba Đình')
    profile = Spree::Pos::TaxProfile.for_store(store)
    expect(profile).to have_attributes(declaration_period: 'quarter', business_area_m2: BigDecimal('32.5'), changed_by: admin)
    expect(Spree::Pos::BranchInfo.for_branch(first)).to have_attributes(tax_location_code: '00001', tax_head_office: true)
    expect(data).to include(name: 'Hộ kinh doanh Hiền', business_area_m2: '32.5', store_info_saved: true)
    expect(data[:readiness]).to eq(filled: 9, total: 9, missing: [])
    expect(data[:locations].pluck(:name)).to eq(['Chi nhánh A', 'Chi nhánh B'])

    audit = Spree::Pos::AuditEntry.find_by!(store: store, action: 'tax_profile.change')
    expect(audit.metadata.dig('to', 'tax_code')).to eq('001234567890')
    expect(audit.metadata.dig('to', 'locations')).to eq([{ 'branch_id' => first.prefixed_id, 'tax_location_code' => '00001',
                                                           'tax_head_office' => true }])
    expect { save({ 'signer_name' => 'Hiền' }) }.not_to change(Spree::Pos::AuditEntry, :count)
  end

  it 'moves the head office from one branch to another' do
    save({}, locations: [{ 'branch_id' => first.prefixed_id, 'tax_head_office' => true }])
    save({}, locations: [{ 'branch_id' => second.prefixed_id, 'tax_head_office' => true, 'tax_location_code' => '00002' }])

    expect(Spree::Pos::BranchInfo.where(store_id: store.id, tax_head_office: true).pluck(:branch_id)).to eq([second.id])
    expect(Spree::Pos::BranchInfo.for_branch(first).tax_head_office).to be(false)

    save({}, locations: [{ 'branch_id' => second.prefixed_id, 'tax_location_code' => '00003' },
                         { 'branch_id' => first.prefixed_id, 'tax_head_office' => true }])
    expect(Spree::Pos::BranchInfo.where(store_id: store.id, tax_head_office: true).pluck(:branch_id)).to eq([first.id])
    expect(Spree::Pos::BranchInfo.for_branch(second).tax_location_code).to eq('00003')
  end

  it 'refuses two head offices in one request and keeps the saved one' do
    save({}, locations: [{ 'branch_id' => first.prefixed_id, 'tax_head_office' => true }])
    expect do
      save({}, locations: [{ 'branch_id' => first.prefixed_id, 'tax_head_office' => true },
                           { 'branch_id' => second.prefixed_id, 'tax_head_office' => true }])
    end.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('tax_head_office_invalid') }
    expect(Spree::Pos::BranchInfo.where(store_id: store.id, tax_head_office: true).pluck(:branch_id)).to eq([first.id])
  end

  it 'collects field errors from the store information, the profile and the locations and saves nothing' do
    expect do
      save({ 'tax_code' => '12345', 'industry_code' => '0000', 'business_area_m2' => '-2' },
           locations: [{ 'branch_id' => first.prefixed_id, 'tax_location_code' => 'a b' }])
    end.to raise_error(ActiveRecord::RecordInvalid) { |error|
      expect(error.record.errors.attribute_names).to contain_exactly(:tax_code, :industry_code, :business_area_m2, :locations)
      expect(error.record.errors[:locations].first).to start_with('Chi nhánh A: ')
    }
    expect(info.reload.tax_code).to be_nil
    expect(Spree::Pos::TaxProfile.for_store(store)).to be_nil
    expect(Spree::Pos::BranchInfo.for_branch(first)).to be_nil
  end

  it 'needs the store information first, a branch of the store and topology write access' do
    info.destroy!
    expect { save({ 'signer_name' => 'A' }) }.
      to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('store_info_required') }

    Spree::Pos::StoreInfo.create!(store: store, name: 'Quán', phone: '0901234567', business_day_cutoff: '04:00')
    other = create(:store)
    location = create(:stock_location, store: other)
    foreign = Spree::Pos::Branch.create!(store: other, stock_location: location, name: 'X', code: 'x1',
                                         timezone: 'Asia/Ho_Chi_Minh', status: 'active')
    expect { save({}, locations: [{ 'branch_id' => foreign.prefixed_id, 'tax_location_code' => '1' }]) }.
      to raise_error(ActiveRecord::RecordNotFound)
    expect { save({ 'signer_name' => 'A' }, actor: staff_with(%w[read_pos_topology])) }.to raise_error(CanCan::AccessDenied)
  end
end
