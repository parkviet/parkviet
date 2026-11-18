# frozen_string_literal: true

# What a store's tax declaration needs beyond its store details: one row per
# store. Taxpayer name, tax code, address and description stay on
# spree_pos_store_infos, so they are not repeated here.
class CreateSpreePosTaxProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_tax_profiles do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }, index: { unique: true }
      t.string :store_code, limit: 32
      t.string :legacy_tax_code, limit: 14
      t.string :declaration_period, limit: 16
      t.string :tax_authority_code, limit: 16
      t.decimal :business_area_m2, precision: 10, scale: 2
      t.string :industry_code, limit: 16
      t.string :signer_name, limit: 120
      t.string :preparer_name, limit: 120
      t.string :storekeeper_name, limit: 120
      t.string :cashier_name, limit: 120
      t.references :changed_by, foreign_key: { to_table: :spree_admin_users }, index: false
      t.timestamps
    end
    add_check_constraint :spree_pos_tax_profiles, "declaration_period IS NULL OR declaration_period IN ('month', 'quarter')",
                         name: 'chk_pos_tax_profiles_period'
    add_check_constraint :spree_pos_tax_profiles, 'business_area_m2 IS NULL OR business_area_m2 >= 0',
                         name: 'chk_pos_tax_profiles_area'
  end
end
