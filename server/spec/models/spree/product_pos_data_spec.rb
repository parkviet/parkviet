# frozen_string_literal: true

require 'rails_helper'
require_relative '../../support/pos_menu_helpers'

# The POS data of a Spree product hangs off the product itself: operating
# settings, combo contents, add-on groups, time-of-day menu rows,
# electronic-menu placements, sold-out marks and favourites. Deleting the
# product leaves none of them behind.
RSpec.describe Spree::Product, 'POS data' do
  include PosMenuHelpers

  let(:store) { menu_store }
  let(:branch) { menu_branch(store) }
  let(:product) { prepared_product!(store, branch, name: 'Phở bò', price: 60_000) }
  let(:drink) { prepared_product!(store, branch, name: 'Trà đá', price: 5_000) }

  # One row in each table that keys POS data by product.
  def attach_everything!(product)
    Spree::Pos::ProductSetting.create!(store: store, product: product, kitchen_category: 'bep', cup_label: true)
    product.pos_combo_components.create!(variant: drink.default_variant, quantity: 1)
    modifier_group!(store, product, name: 'Độ cay', options: { 'Cay' => 0 })
    schedule = Spree::Pos::MenuSchedule.create!(store: store, name: 'Giờ vàng', starts_at: '14:00', ends_at: '16:00')
    schedule.menu_schedule_items.create!(product: product, price: 50_000)
    category = Spree::Pos::EmenuCategory.create!(branch: branch, name: 'Món nước')
    category.emenu_items.create!(product: product, position: 0)
    Spree::Pos::MenuAvailability.create!(branch: branch, product: product, sold_out_on: Date.new(2026, 11, 20))
    Spree::Pos::MenuFavorite.create!(branch: branch, product: product, position: 0)
    product.reload
  end

  def pos_rows(product)
    {
      settings: Spree::Pos::ProductSetting.where(product_id: product.id).count,
      combo_components: Spree::Pos::ComboComponent.where(product_id: product.id).count,
      modifier_groups: Spree::Pos::ProductModifierGroup.where(product_id: product.id).count,
      schedule_items: Spree::Pos::MenuScheduleItem.where(product_id: product.id).count,
      emenu_items: Spree::Pos::EmenuItem.where(product_id: product.id).count,
      availabilities: Spree::Pos::MenuAvailability.where(product_id: product.id).count,
      favorites: Spree::Pos::MenuFavorite.where(product_id: product.id).count
    }
  end

  it 'reaches every POS row of the product through its associations' do
    attach_everything!(product)

    expect(product.pos_setting).to have_attributes(kitchen_category: 'bep', cup_label: true)
    expect(product.pos_combo_components.map(&:variant)).to eq([drink.default_variant])
    expect(product.pos_modifier_groups.map(&:name)).to eq(['Độ cay'])
    expect(product.pos_menu_schedule_items.sole.price).to eq(50_000)
    expect(product.pos_emenu_items.sole.emenu_category.name).to eq('Món nước')
    expect(product.pos_menu_availabilities.sole.branch).to eq(branch)
    expect(product.pos_menu_favorites.sole.branch).to eq(branch)
    expect(pos_rows(product).values).to all(eq(1))
  end

  it 'takes all of its POS rows with it when deleted' do
    attach_everything!(product)
    group = product.pos_modifier_groups.sole

    product.destroy!

    expect(pos_rows(product).values).to all(be_zero)
    expect(Spree::Pos::ModifierGroup.exists?(group.id)).to be(true)
    expect(drink.reload.deleted_at).to be_nil
  end

  it 'lets the database drop the rows of a product removed outright' do
    %w[spree_pos_product_settings spree_pos_combo_components spree_pos_product_modifier_groups spree_pos_menu_schedule_items
       spree_pos_emenu_items spree_pos_menu_availabilities spree_pos_menu_favorites].each do |table|
      key = ActiveRecord::Base.connection.foreign_keys(table).find { |fk| fk.column == 'product_id' }
      expect(key).to have_attributes(to_table: 'spree_products', on_delete: :cascade), table
      column = ActiveRecord::Base.connection.columns(table).find { |row| row.name == 'product_id' }
      expect(column.null).to be(false), table
      expect(ActiveRecord::Base.connection.column_exists?(table, :menu_item_id)).to be(false), table
    end
    expect(ActiveRecord::Base.connection.table_exists?(:spree_pos_menu_items)).to be(false)
    expect(ActiveRecord::Base.connection.table_exists?(:spree_pos_menu_categories)).to be(false)
  end

  it 'keeps one row per product where the old menu kept one per item' do
    group = modifier_group!(store, product, name: 'Đá', options: { 'Ít đá' => 0 })
    expect(Spree::Pos::ProductModifierGroup.new(product: product, modifier_group: group)).not_to be_valid
    product.pos_combo_components.create!(variant: drink.default_variant, quantity: 1)
    expect(product.pos_combo_components.new(variant: drink.default_variant, quantity: 2)).not_to be_valid
    Spree::Pos::MenuFavorite.create!(branch: branch, product: product, position: 0)
    expect(Spree::Pos::MenuFavorite.new(branch: branch, product: product, position: 1)).not_to be_valid
    Spree::Pos::MenuAvailability.create!(branch: branch, product: product)
    expect { Spree::Pos::MenuAvailability.new(branch: branch, product: product).save!(validate: false) }.
      to raise_error(ActiveRecord::RecordNotUnique)
  end

  it 'refuses POS rows that cross stores' do
    other = menu_store
    foreign = create(:product, store: other)
    other_group = Spree::Pos::ModifierGroup.create!(store: other, name: 'Đá', min_select: 0, max_select: 1)

    expect(Spree::Pos::ProductModifierGroup.new(product: product, modifier_group: other_group)).not_to be_valid
    expect(product.pos_combo_components.new(variant: foreign.default_variant, quantity: 1)).not_to be_valid
    expect(Spree::Pos::MenuFavorite.new(branch: branch, product: foreign, position: 0)).not_to be_valid
    expect(Spree::Pos::MenuAvailability.new(branch: branch, product: foreign)).not_to be_valid
    schedule = Spree::Pos::MenuSchedule.create!(store: store, name: 'Giờ vàng', starts_at: '14:00', ends_at: '16:00')
    expect(schedule.menu_schedule_items.new(product: foreign, price: 1)).not_to be_valid
    expect(schedule.menu_schedule_items.new(product: product, variant: drink.default_variant, price: 1)).not_to be_valid
    category = Spree::Pos::EmenuCategory.create!(branch: branch, name: 'Món nước')
    expect(category.emenu_items.new(product: foreign, position: 0)).not_to be_valid
  end

  it 'reads sold-out marks and favourites by product id' do
    today = Date.new(2026, 11, 20)
    Spree::Pos::MenuAvailability.create!(branch: branch, product: product, sold_out_on: today)
    Spree::Pos::MenuAvailability.create!(branch: branch, product: drink, sold_out_on: today - 1)
    expect(Spree::Pos::MenuAvailability.sold_out_ids(branch, today)).to eq([product.id])
    expect(Spree::Pos::MenuAvailability.sold_out?(branch, product, today)).to be(true)
    expect(Spree::Pos::MenuAvailability.sold_out?(branch, drink, today)).to be(false)

    Spree::Pos::MenuFavorite.create!(branch: branch, product: drink, position: 0)
    Spree::Pos::MenuFavorite.create!(branch: branch, product: product, position: 1)
    expect(Spree::Pos::MenuFavorite.product_ids(branch)).to eq([drink.id, product.id])
  end

  it 'is a combo when it lists what it contains' do
    expect(product).not_to be_combo
    combo = combo_of!(prepared_product!(store, branch, name: 'Combo phở', price: 70_000),
                      product.default_variant => 1, drink.default_variant => 2)
    expect(combo).to be_combo
    expect(combo.pos_combo_components.map(&:quantity)).to eq([1, 2])
    expect(described_class.includes(:pos_combo_components).find(combo.id)).to be_combo
  end

  it 'is a door ticket when its settings carry a drink credit' do
    expect(product).not_to be_door_ticket
    Spree::Pos::ProductSetting.create!(store: store, product: product, cup_label: true)
    expect(product.reload).not_to be_door_ticket

    ticket = prepared_product!(store, branch, name: 'Vé uống bia', price: 100_000,
                                              settings: { drink_credit: 100_000, drink_credit_categories: %w[do_uong] })
    expect(ticket).to be_door_ticket
  end

  it 'knows the prepared products by their product type name, however it is written' do
    plain = prepared_product!(store, branch, name: 'Nước suối', price: 10_000,
                                             type: Spree::ProductType.create!(store: store, name: 'Sản phẩm thường'))
    untyped = prepared_product!(store, branch, name: 'Khăn lạnh', price: 2_000, type: nil)
    respelled = Spree::ProductType.create!(store: store, name: '  san PHAM  che bien ')
    other_prepared = prepared_product!(store, branch, name: 'Bún chả', price: 55_000, type: respelled)

    expect(product).to be_pos_prepared
    expect(other_prepared).to be_pos_prepared
    expect(plain).not_to be_pos_prepared
    expect(plain.pos_kind).to eq('goods')
    expect(untyped.pos_kind).to be_nil
    expect(described_class.pos_prepared(store)).to contain_exactly(product, other_prepared)

    foreign = create(:product, store: menu_store)
    expect(described_class.pos_prepared(store)).not_to include(foreign)
  end

  it 'sells its variants as sizes by position, without the discontinued ones' do
    tea = prepared_product!(store, branch, name: 'Trà sữa', price: 30_000, sizes: { 'M' => 30_000, 'L' => 38_000 })
    medium, large = tea.pos_sizes
    expect([medium, large].map { |variant| variant.option_values.map(&:presentation) }).to eq([%w[M], %w[L]])

    large.update!(discontinue_on: 1.day.ago)
    expect(tea.reload.pos_sizes(now: Time.current)).to eq([medium])
    expect(tea.pos_sizes).to eq([medium, large])
  end
end
