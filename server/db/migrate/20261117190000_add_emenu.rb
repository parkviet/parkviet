# frozen_string_literal: true

# A branch's electronic menu: colours, lists and sticker text live in
# `emenu_settings`; the menu itself is its own categories and items, chosen
# from the store's menu. A guest order can also wait for a transfer
# (`awaiting_payment`) or settle on its own order once paid (`workspace_id`
# nullable until accepted).
class AddEmenu < ActiveRecord::Migration[8.1]
  def up
    add_column :spree_pos_branches, :emenu_settings, :jsonb, null: false, default: {}
    add_check_constraint :spree_pos_branches, "jsonb_typeof(emenu_settings) = 'object'", name: 'chk_pos_branches_emenu_settings'

    create_table :spree_pos_emenu_categories do |t|
      t.references :branch, null: false, foreign_key: { to_table: :spree_pos_branches }, index: false
      t.string :name, null: false, limit: 80
      t.integer :position, null: false, default: 0
      t.string :color, limit: 7
      t.timestamps
    end
    add_index :spree_pos_emenu_categories, [:branch_id, :position], name: 'idx_pos_emenu_categories_position'

    create_table :spree_pos_emenu_items do |t|
      t.references :emenu_category, null: false, foreign_key: { to_table: :spree_pos_emenu_categories }, index: false
      t.references :menu_item, null: false, foreign_key: { to_table: :spree_pos_menu_items }, index: true
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :spree_pos_emenu_items, [:emenu_category_id, :position], name: 'idx_pos_emenu_items_position'
    add_index :spree_pos_emenu_items, [:emenu_category_id, :menu_item_id], unique: true, name: 'idx_pos_emenu_items_unique'

    change_column_null :spree_pos_guest_orders, :workspace_id, true
    change_table :spree_pos_guest_orders, bulk: true do |t|
      t.string :pay_method, limit: 16
      t.datetime :payment_expires_at
      t.string :payment_code, limit: 32
      t.boolean :prepaid, null: false, default: false
    end
    add_index :spree_pos_guest_orders, :payment_code, unique: true, where: 'payment_code IS NOT NULL', name: 'idx_pos_guest_orders_payment_code'
    add_check_constraint :spree_pos_guest_orders, "pay_method IS NULL OR pay_method IN ('vietqr', 'counter')", name: 'chk_pos_guest_orders_pay_method'

    remove_check_constraint :spree_pos_guest_orders, name: 'chk_pos_guest_orders_status'
    add_check_constraint :spree_pos_guest_orders,
                         "status IN ('pending', 'awaiting_payment', 'accepted', 'rejected', 'expired', 'canceled')",
                         name: 'chk_pos_guest_orders_status'
    remove_check_constraint :spree_pos_guest_orders, name: 'chk_pos_guest_orders_decided'
    add_check_constraint :spree_pos_guest_orders,
                         "(status IN ('pending', 'awaiting_payment')) = (decided_at IS NULL)",
                         name: 'chk_pos_guest_orders_decided'
  end

  def down
    execute('DELETE FROM spree_pos_guest_orders WHERE workspace_id IS NULL')
    remove_check_constraint :spree_pos_guest_orders, name: 'chk_pos_guest_orders_decided'
    add_check_constraint :spree_pos_guest_orders, "(status::text = 'pending'::text) = (decided_at IS NULL)", name: 'chk_pos_guest_orders_decided'
    remove_check_constraint :spree_pos_guest_orders, name: 'chk_pos_guest_orders_status'
    add_check_constraint :spree_pos_guest_orders,
                         "status::text = ANY (ARRAY['pending'::character varying::text, 'accepted'::character varying::text, " \
                         "'rejected'::character varying::text, 'expired'::character varying::text])",
                         name: 'chk_pos_guest_orders_status'
    remove_check_constraint :spree_pos_guest_orders, name: 'chk_pos_guest_orders_pay_method'
    remove_index :spree_pos_guest_orders, name: 'idx_pos_guest_orders_payment_code'
    change_table :spree_pos_guest_orders, bulk: true do |t|
      t.remove :prepaid, :payment_code, :payment_expires_at, :pay_method
    end
    change_column_null :spree_pos_guest_orders, :workspace_id, false
    drop_table :spree_pos_emenu_items
    drop_table :spree_pos_emenu_categories
    remove_check_constraint :spree_pos_branches, name: 'chk_pos_branches_emenu_settings'
    remove_column :spree_pos_branches, :emenu_settings
  end
end
