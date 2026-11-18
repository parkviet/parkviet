# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::BranchInfo, type: :model do
  let(:store) { create(:store) }

  def branch_of(target)
    location = create(:stock_location, store: target)
    Spree::Pos::Branch.create!(store: target, stock_location: location, name: 'Quầy', code: "q#{SecureRandom.hex(3)}",
                               timezone: 'Asia/Ho_Chi_Minh', status: 'active')
  end

  it 'allows one head office per store, in the model and in the database' do
    described_class.create!(store: store, branch: branch_of(store), tax_head_office: true)
    second = described_class.new(store: store, branch: branch_of(store), tax_head_office: true)
    expect(second).not_to be_valid
    expect(second.errors[:tax_head_office]).to be_present
    expect { second.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)

    other = create(:store)
    expect(described_class.new(store: other, branch: branch_of(other), tax_head_office: true)).to be_valid
  end

  it 'strips the location code and refuses one with spaces or symbols' do
    row = described_class.new(store: store, branch: branch_of(store), tax_location_code: ' 00001 ')
    expect(row).to be_valid
    expect(row.tax_location_code).to eq('00001')
    row.tax_location_code = '0 1/2'
    expect(row).not_to be_valid
  end

  it 'takes a 12-digit personal identification number as a tax code' do
    branch = branch_of(store)
    expect(described_class.new(store: store, branch: branch, tax_code: '001234567890')).to be_valid
    expect(described_class.new(store: store, branch: branch, tax_code: '0312345678-001')).to be_valid
    expect(described_class.new(store: store, branch: branch, tax_code: '00123456789')).not_to be_valid
  end
end
