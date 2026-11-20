# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::Branch, type: :model do
  let(:store) { create(:store) }

  def branch_of(target = store, status: 'active')
    location = create(:stock_location, store: target)
    described_class.create!(store: target, stock_location: location, name: 'Quầy', code: "q#{SecureRandom.hex(3)}",
                            timezone: 'Asia/Ho_Chi_Minh', status: status)
  end

  describe 'the default branch' do
    it 'makes the first branch of a store its default and leaves later ones alone' do
      first = branch_of
      second = branch_of
      expect(first.reload).to be_is_default
      expect(second.reload).not_to be_is_default
      expect(first.to_pos).to include(is_default: true)
      expect(branch_of(create(:store))).to be_is_default
    end

    it 'moves the flag to the chosen branch in one step' do
      first = branch_of
      second = branch_of
      second.update!(is_default: true)
      expect(first.reload).not_to be_is_default
      expect(second.reload).to be_is_default
      expect(described_class.where(store_id: store.id, is_default: true).count).to eq(1)
    end

    it 'refuses a disabled branch as the default, in the model' do
      branch_of
      disabled = branch_of(status: 'disabled')
      disabled.is_default = true
      expect(disabled).not_to be_valid
      expect(disabled.errors[:is_default]).to be_present
    end

    it 'allows only one default per store in the database' do
      first = branch_of
      second = branch_of
      expect { described_class.transaction(requires_new: true) { second.update_columns(is_default: true) } }.to raise_error(ActiveRecord::RecordNotUnique)
      expect(first.reload).to be_is_default
    end

    it 'hands the flag to the oldest active branch when the default is disabled' do
      first = branch_of
      second = branch_of
      third = branch_of
      third.update!(status: 'disabled')
      first.update!(status: 'disabled')
      expect(first.reload).not_to be_is_default
      expect(second.reload).to be_is_default
      expect(third.reload).not_to be_is_default
    end

    it 'leaves a store with no active branch without a default, and picks one when a branch comes back' do
      only = branch_of
      only.update!(status: 'disabled')
      expect(described_class.where(store_id: store.id, is_default: true)).to be_empty
      only.update!(status: 'active')
      expect(only.reload).to be_is_default
    end
  end
end
