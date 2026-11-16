# frozen_string_literal: true

# Where each dashboard user arranged the widgets of the POS dashboard home
# page, one layout per store and user. No row means the built-in layout.
class CreateSpreePosDashboardLayouts < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_dashboard_layouts do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores, on_delete: :cascade }, index: false
      t.references :user, null: false, foreign_key: { to_table: :spree_admin_users, on_delete: :cascade }
      t.jsonb :layout, null: false, default: []
      t.integer :version, null: false, default: 1
      t.timestamps
    end
    add_index :spree_pos_dashboard_layouts, %i[store_id user_id], unique: true, name: 'idx_pos_dashboard_layouts_owner'
    add_check_constraint :spree_pos_dashboard_layouts, "jsonb_typeof(layout) = 'array'", name: 'chk_pos_dashboard_layouts_array'
  end
end
