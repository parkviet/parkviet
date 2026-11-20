# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../support/pos_menu_helpers'

# Add-on groups whose min never passes their max, and line copies that stay
# as sold when the option changes or goes away.
RSpec.describe Spree::Pos::ModifierGroup do
  include PosMenuHelpers

  let(:store) { menu_store }
  let(:branch) { menu_branch(store) }
  let(:product) { prepared_product!(store, branch, name: 'Cà phê sữa', price: 25_000) }

  it 'refuses a group whose min passes its max, in the model and in the table' do
    group = described_class.new(store: store, name: 'Đá', min_select: 2, max_select: 1)
    expect(group).not_to be_valid
    expect(group.errors.attribute_names).to include(:min_select)
    expect { group.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid, /chk_pos_modifier_groups_select/)
    expect(described_class.new(store: store, name: 'Đá', min_select: 0, max_select: 0)).not_to be_valid
  end

  it 'drops its product links, not the products, when deleted' do
    group = modifier_group!(store, product, name: 'Đá', options: { 'Ít đá' => 0 })
    group.destroy!
    expect(product.reload.pos_product_modifier_groups).to be_empty
    expect(product).to be_persisted
  end

  it 'keeps the line copy of an option when the option is changed or deleted' do
    group = modifier_group!(store, product, name: 'Topping', options: { 'Trân châu' => 5_000 }, max: 2)
    sale = menu_sale(store, branch)
    add_menu(sale, size(product), modifiers: picks([option(group, 'Trân châu')]))
    copy = Spree::Pos::LineModifier.sole
    expect(copy).to have_attributes(name: 'Trân châu', group_name: 'Topping', price_delta: 5_000, quantity: 1)

    option(group, 'Trân châu').update!(name: 'Trân châu đen', price_delta: 7_000)
    group.update!(name: 'Thêm')
    expect(copy.reload).to have_attributes(name: 'Trân châu', group_name: 'Topping', price_delta: 5_000)

    group.destroy!
    expect(copy.reload).to have_attributes(modifier_option_id: nil, name: 'Trân châu', price_delta: 5_000)
    expect(menu_lines(sale).sole.unit_price).to eq(30_000)
  end
end
