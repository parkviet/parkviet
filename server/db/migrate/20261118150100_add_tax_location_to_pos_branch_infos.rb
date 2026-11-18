# frozen_string_literal: true

# A branch is a business location of the store's taxpayer: the location code
# the tax office gave it, and which one is the head office (at most one per
# store).
class AddTaxLocationToPosBranchInfos < ActiveRecord::Migration[8.1]
  def change
    change_table :spree_pos_branch_infos, bulk: true do |t|
      t.string :tax_location_code, limit: 20
      t.boolean :tax_head_office, null: false, default: false
    end
    add_index :spree_pos_branch_infos, :store_id, unique: true, where: 'tax_head_office',
                                                  name: 'idx_pos_branch_infos_one_head_office'
  end
end
