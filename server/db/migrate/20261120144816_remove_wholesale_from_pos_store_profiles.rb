# frozen_string_literal: true

# Wholesale at the till is expressed by quantity price lists; the recorded
# flag never gated anything, so the column goes with its setup step.
class RemoveWholesaleFromPosStoreProfiles < ActiveRecord::Migration[8.1]
  def change
    remove_column :spree_pos_store_profiles, :wholesale, :boolean, default: false, null: false
  end
end
