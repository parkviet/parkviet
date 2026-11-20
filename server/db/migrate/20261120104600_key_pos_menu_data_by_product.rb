# frozen_string_literal: true

# The POS sells Spree products directly. A product's POS operating settings
# (kitchen routing, cup label, door-ticket credit, table-QR ordering) live in
# `spree_pos_product_settings`, one optional row per product; no row means the
# defaults. Combos, add-on groups, time-of-day menu rows, electronic-menu
# placements, sold-out marks and favourites point at the product itself.
# Menu groups are the store's Spree categories, so the POS menu item and menu
# category tables go away.
#
# Rows of the six tables that pointed at menu items are dropped with them: the
# development database is seeded again from the new model, and no sale or
# order ever referenced a menu item.
class KeyPosMenuDataByProduct < ActiveRecord::Migration[8.1]
  CHILD_TABLES = %i[
    spree_pos_combo_components spree_pos_menu_item_modifier_groups spree_pos_menu_schedule_items
    spree_pos_emenu_items spree_pos_menu_availabilities spree_pos_menu_favorites
  ].freeze

  def up
    CHILD_TABLES.each do |table|
      execute("DELETE FROM #{table}")
      remove_foreign_key table, column: :menu_item_id
      remove_column table, :menu_item_id
    end
    rename_table :spree_pos_menu_item_modifier_groups, :spree_pos_product_modifier_groups
    drop_table :spree_pos_menu_items
    drop_table :spree_pos_menu_categories

    create_table :spree_pos_product_settings do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }
      t.references :product, null: false, foreign_key: { to_table: :spree_products, on_delete: :cascade }
      t.string :kitchen_category, limit: 40
      t.boolean :cup_label, null: false, default: false
      t.boolean :show_components_on_kds, null: false, default: true
      t.boolean :qr_orderable, null: false, default: true
      t.decimal :drink_credit, precision: 19, scale: 4
      t.jsonb :drink_credit_categories, null: false, default: []
      t.timestamps
    end
    add_index :spree_pos_product_settings, %i[store_id product_id], unique: true, name: 'idx_pos_product_settings_product'
    add_check_constraint :spree_pos_product_settings, "kitchen_category IS NULL OR kitchen_category ~ '^[a-z_]{2,40}$'",
                         name: 'chk_pos_product_settings_kitchen_category'
    add_check_constraint :spree_pos_product_settings, 'drink_credit IS NULL OR drink_credit > 0',
                         name: 'chk_pos_product_settings_drink_credit'

    # The combo is the product; what it contains stays a variant.
    add_product :spree_pos_combo_components, index: false
    add_index :spree_pos_combo_components, %i[product_id variant_id], unique: true, name: 'idx_pos_combo_components_pair'

    add_product :spree_pos_product_modifier_groups, index: false
    add_index :spree_pos_product_modifier_groups, %i[product_id modifier_group_id], unique: true,
                                                                                    name: 'idx_pos_product_modifier_groups_pair'

    add_product :spree_pos_menu_schedule_items
    add_index :spree_pos_menu_schedule_items, 'menu_schedule_id, product_id, COALESCE(variant_id, 0)', unique: true,
                                                                                                       name: 'idx_pos_menu_schedule_items_target'

    add_product :spree_pos_emenu_items
    add_index :spree_pos_emenu_items, %i[emenu_category_id product_id], unique: true, name: 'idx_pos_emenu_items_unique'

    add_product :spree_pos_menu_availabilities
    add_index :spree_pos_menu_availabilities, %i[branch_id product_id], unique: true, name: 'idx_pos_menu_availabilities_pair'

    add_product :spree_pos_menu_favorites
    add_index :spree_pos_menu_favorites, %i[branch_id product_id], unique: true, name: 'idx_pos_menu_favorites_pair'
  end

  # The menu item rows are not kept, so there is nothing to go back to.
  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def add_product(table, index: true)
    add_reference table, :product, null: false, index: index, foreign_key: { to_table: :spree_products, on_delete: :cascade }
  end
end
