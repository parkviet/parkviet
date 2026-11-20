# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../support/pos_menu_helpers'

# The POS operating settings of a product: one optional row per product of
# the store, a kitchen key the kitchen can route by, a positive drink credit,
# and the table's checks behind the model's.
RSpec.describe Spree::Pos::ProductSetting do
  include PosMenuHelpers

  let(:store) { menu_store }
  let(:branch) { menu_branch(store) }
  let(:product) { prepared_product!(store, branch, name: 'Cà phê sữa', price: 25_000) }

  it 'is one row per product of the store, with a prefixed id' do
    setting = described_class.create!(store: store, product: product)
    expect(setting.prefixed_id).to start_with('posprodset_')
    expect(setting).to have_attributes(kitchen_category: nil, cup_label: false, show_components_on_kds: true, qr_orderable: true,
                                       drink_credit: nil, drink_credit_categories: [])

    duplicate = described_class.new(store: store, product: product)
    expect(duplicate).not_to be_valid
    expect(duplicate.errors.attribute_names).to include(:product_id)
    expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)

    foreign = create(:product, store: create(:store))
    expect(described_class.new(store: store, product: foreign)).not_to be_valid
  end

  it 'accepts a kitchen key of lower-case letters and underscores only, in the model and in the table' do
    setting = described_class.new(store: store, product: product, kitchen_category: 'quay_bar')
    expect(setting).to be_valid
    ['Bar', 'b', 'quầy', 'bar-1', 'x' * 41].each do |value|
      setting.kitchen_category = value
      expect(setting).not_to be_valid, value
    end
    setting.kitchen_category = 'Bar'
    expect { setting.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid, /chk_pos_product_settings_kitchen_category/)
  end

  it 'takes a positive drink credit and up to twenty kitchen keys it may be spent on' do
    setting = described_class.new(store: store, product: product, drink_credit: 100_000, drink_credit_categories: %w[do_uong])
    expect(setting).to be_valid
    expect(setting).to be_door_ticket

    setting.drink_credit_categories = ['Bia']
    expect(setting).not_to be_valid
    setting.drink_credit_categories = Array.new(21) { |index| "cat_#{('a'.ord + index).chr}x" }
    expect(setting).not_to be_valid
    setting.drink_credit_categories = 'do_uong'
    expect(setting).not_to be_valid

    setting.drink_credit_categories = []
    setting.drink_credit = 0
    expect(setting).not_to be_valid
    expect { setting.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid, /chk_pos_product_settings_drink_credit/)
  end

  it 'reads the defaults for a product without a row, without saving one' do
    setting = described_class.for_product(product)
    expect(setting).to be_new_record
    expect(setting).to have_attributes(store_id: store.id, product_id: product.id, cup_label: false, qr_orderable: true)
    expect(setting).not_to be_door_ticket

    saved = described_class.create!(store: store, product: product, cup_label: true)
    expect(described_class.for_product(product.reload)).to eq(saved)
  end
end
