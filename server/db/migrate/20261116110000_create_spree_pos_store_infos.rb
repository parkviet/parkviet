# frozen_string_literal: true

# POS store details (one row per store) and per-branch overrides (null means
# inherit). Industry profiles gain an ordered list; the first key stays in
# profile_key so existing readers keep working. Existing branch cutoffs are
# left as they are: a null cutoff is the only one that inherits.
class CreateSpreePosStoreInfos < ActiveRecord::Migration[8.1]
  def up
    create_table :spree_pos_store_infos do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }, index: { unique: true }
      t.string :name, limit: 120, null: false
      t.string :phone, limit: 15, null: false
      t.string :admin_email
      t.string :contact_email
      t.string :tax_code, limit: 14
      t.string :representative_id_number, limit: 12
      t.time :opening_time
      t.time :closing_time
      t.time :business_day_cutoff, null: false, default: '2000-01-01 04:00:00'
      t.string :province_code, limit: 8
      t.string :ward_code, limit: 8
      t.string :province_name, limit: 80
      t.string :ward_name, limit: 80
      t.string :street, limit: 200
      t.text :description
      t.references :changed_by, foreign_key: { to_table: :spree_admin_users }, index: false
      t.timestamps
    end

    create_table :spree_pos_branch_infos do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }, index: true
      t.references :branch, null: false, foreign_key: { to_table: :spree_pos_branches }, index: { unique: true }
      t.string :name, limit: 120
      t.string :phone, limit: 15
      t.string :admin_email
      t.string :contact_email
      t.string :tax_code, limit: 14
      t.string :representative_id_number, limit: 12
      t.time :opening_time
      t.time :closing_time
      t.string :province_code, limit: 8
      t.string :ward_code, limit: 8
      t.string :province_name, limit: 80
      t.string :ward_name, limit: 80
      t.string :street, limit: 200
      t.text :description
      t.references :changed_by, foreign_key: { to_table: :spree_admin_users }, index: false
      t.timestamps
    end

    add_column :spree_pos_store_profiles, :profile_keys, :jsonb, null: false, default: []
    add_column :spree_pos_branches, :profile_keys, :jsonb, null: false, default: []
    change_column_null :spree_pos_branches, :business_day_cutoff, true
    change_column_default :spree_pos_branches, :business_day_cutoff, from: '2000-01-01 04:00:00', to: nil
    backfill!
  end

  def down
    change_column_default :spree_pos_branches, :business_day_cutoff, from: nil, to: '2000-01-01 04:00:00'
    change_column_null :spree_pos_branches, :business_day_cutoff, false, '2000-01-01 04:00:00'
    remove_column :spree_pos_branches, :profile_keys
    remove_column :spree_pos_store_profiles, :profile_keys
    drop_table :spree_pos_branch_infos
    drop_table :spree_pos_store_infos
  end

  # Fills an empty profile list from the single key. Does not touch cutoffs.
  def backfill!
    execute <<~SQL.squish
      UPDATE spree_pos_store_profiles
      SET profile_keys = jsonb_build_array(profile_key)
      WHERE profile_keys = '[]'::jsonb
    SQL
    execute <<~SQL.squish
      UPDATE spree_pos_branches
      SET profile_keys = jsonb_build_array(profile_key)
      WHERE profile_keys = '[]'::jsonb
    SQL
  end
end
