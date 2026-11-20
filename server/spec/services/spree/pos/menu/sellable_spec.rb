# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_menu_helpers'

# What a branch sells at the till: active products on the store's `pos`
# channel that the branch was given, never an ingredient.
RSpec.describe Spree::Pos::Menu::Sellable do
  include PosMenuHelpers

  let(:store) { menu_store }
  let(:branch) { menu_branch(store) }
  let!(:dish) { prepared_product!(store, branch, name: 'Phở bò', price: 60_000) }
  let(:channel) { store.channels.find_by!(code: Spree::Pos::SalesChannel::CODE) }

  it 'sells the branch products on the pos channel, prepared or not' do
    plain = prepared_product!(store, branch, name: 'Nước suối', price: 10_000,
                                             type: Spree::ProductType.create!(store: store, name: 'Sản phẩm thường'))
    untyped = prepared_product!(store, branch, name: 'Khăn lạnh', price: 2_000, type: nil)

    expect(described_class.products(branch)).to contain_exactly(dish, plain, untyped)
    expect(described_class.prepared(branch)).to contain_exactly(dish)
    expect(described_class.product?(branch, dish)).to be(true)
    expect(described_class.product?(branch, nil)).to be(false)
  end

  it 'leaves out a product the branch was not given' do
    elsewhere = create(:product, store: store, status: 'active', name: 'Bún chả')
    Spree::ProductPublication.create!(product: elsewhere, channel: channel)

    expect(described_class.products(branch)).to contain_exactly(dish)
    expect(described_class.product?(branch, elsewhere)).to be(false)
    expect(described_class.products(menu_branch(store))).to be_empty
  end

  it 'leaves out a product that is not active, not on the pos channel, or not yet or no longer available' do
    draft = prepared_product!(store, branch, name: 'Lẩu thái', price: 250_000)
    draft.update_columns(status: 'draft')
    unpublished = prepared_product!(store, branch, name: 'Lẩu nấm', price: 220_000)
    Spree::ProductPublication.where(product: unpublished).delete_all
    later = prepared_product!(store, branch, name: 'Lẩu bò', price: 280_000)
    later.update_columns(available_on: 1.day.from_now)
    gone = prepared_product!(store, branch, name: 'Lẩu cá', price: 260_000)
    gone.update_columns(discontinue_on: 1.day.ago)

    expect(described_class.products(branch)).to contain_exactly(dish)
  end

  it 'never sells an ingredient, even one given to the branch and published' do
    ingredient = prepared_product!(store, branch, name: 'Thịt bò', price: 200_000,
                                                  type: Spree::ProductType.create!(store: store, name: 'Nguyen lieu'))

    expect(described_class.products(branch)).to contain_exactly(dish)
    expect(described_class.product?(branch, ingredient)).to be(false)
  end
end
