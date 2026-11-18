# frozen_string_literal: true

# The store's tax configuration as a history (the latest row is in force),
# the year's revenue against the tax threshold, and the tax each line of a
# direct-method sale owes, written when the sale completes or is returned.
class CreateSpreePosTaxRegimes < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_tax_regimes do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }, index: false
      t.boolean :enabled, null: false, default: true
      t.string :tax_method, null: false, limit: 16
      t.string :revenue_group, null: false, limit: 16
      t.string :pit_method, limit: 16
      t.decimal :pit_income_rate, precision: 6, scale: 5
      t.references :default_item_tax_category, foreign_key: { to_table: :spree_tax_categories }, index: false
      t.references :default_service_fee_tax_category, foreign_key: { to_table: :spree_tax_categories }, index: false
      t.references :default_shipping_tax_category, foreign_key: { to_table: :spree_tax_categories }, index: false
      t.boolean :prices_include_tax, null: false, default: true
      t.boolean :apply_reduction, null: false, default: false
      t.boolean :threshold_warning, null: false, default: true
      t.references :changed_by, foreign_key: { to_table: :spree_admin_users }, index: false
      t.datetime :created_at, null: false
    end
    add_index :spree_pos_tax_regimes, %i[store_id id], name: 'idx_pos_tax_regimes_store'
    add_check_constraint :spree_pos_tax_regimes, "tax_method IN ('direct', 'deduction')", name: 'chk_pos_tax_regimes_method'
    add_check_constraint :spree_pos_tax_regimes, "revenue_group IN ('group_1', 'group_2', 'group_3', 'group_4')",
                         name: 'chk_pos_tax_regimes_group'
    add_check_constraint :spree_pos_tax_regimes, "pit_method IS NULL OR pit_method IN ('revenue', 'income')",
                         name: 'chk_pos_tax_regimes_pit_method'

    create_table :spree_pos_tax_revenue_years do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }, index: false
      t.integer :year, null: false
      t.decimal :revenue, precision: 19, scale: 4, null: false, default: 0
      t.date :crossed_on
      t.string :crossed_period, limit: 8
      t.timestamps
    end
    add_index :spree_pos_tax_revenue_years, %i[store_id year], unique: true, name: 'idx_pos_tax_revenue_years_store_year'

    create_table :spree_pos_line_tax_snapshots do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }, index: false
      t.references :order, null: false, foreign_key: { to_table: :spree_orders }
      t.references :line_item, foreign_key: { to_table: :spree_line_items }, index: false
      t.references :fee, foreign_key: { to_table: :spree_fees, on_delete: :nullify }, index: false
      t.references :fulfillment, foreign_key: { to_table: :spree_fulfillments }, index: false
      t.references :return_operation, foreign_key: { to_table: :spree_pos_return_operations }, index: false
      t.references :tax_category, foreign_key: { to_table: :spree_tax_categories }, index: false
      t.references :regime, null: false, foreign_key: { to_table: :spree_pos_tax_regimes }, index: false
      t.string :kind, null: false, limit: 16
      t.string :rate_key, null: false, limit: 64
      t.decimal :vat_rate, precision: 6, scale: 5
      t.decimal :pit_rate, precision: 6, scale: 5
      t.decimal :revenue_amount, precision: 19, scale: 4, null: false
      t.decimal :vat_amount, precision: 19, scale: 4, null: false
      t.decimal :pit_base_amount, precision: 19, scale: 4, null: false
      t.decimal :pit_amount, precision: 19, scale: 4, null: false
      t.date :business_date, null: false
      t.datetime :created_at, null: false
    end
    add_index :spree_pos_line_tax_snapshots, %i[store_id business_date], name: 'idx_pos_line_tax_snapshots_store_date'
    add_index :spree_pos_line_tax_snapshots, :line_item_id, name: 'idx_pos_line_tax_snapshots_line_item'
    add_check_constraint :spree_pos_line_tax_snapshots, "kind IN ('item', 'fee', 'shipping')", name: 'chk_pos_line_tax_snapshots_kind'
  end
end
