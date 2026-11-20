# frozen_string_literal: true

# Tax is set on each item, so the store profile no longer carries the two
# menu tax defaults the F&B setup step used to choose.
class RemoveMenuTaxDefaultsFromPosStoreProfiles < ActiveRecord::Migration[8.1]
  def change
    remove_reference :spree_pos_store_profiles, :food_tax_category,
                     foreign_key: { to_table: :spree_tax_categories }, index: false
    remove_reference :spree_pos_store_profiles, :alcohol_tax_category,
                     foreign_key: { to_table: :spree_tax_categories }, index: false
  end
end
