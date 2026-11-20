# frozen_string_literal: true

# One branch per store opens first when nothing else names one. The oldest
# branch of each store starts as the default, so every store has one.
class AddIsDefaultToPosBranches < ActiveRecord::Migration[8.1]
  def up
    add_column :spree_pos_branches, :is_default, :boolean, default: false, null: false
    add_index :spree_pos_branches, :store_id, unique: true, where: 'is_default', name: 'index_spree_pos_branches_one_default_per_store'
    execute <<~SQL.squish
      UPDATE spree_pos_branches SET is_default = TRUE
      WHERE id IN (
        SELECT DISTINCT ON (store_id) id FROM spree_pos_branches
        WHERE status = 'active' ORDER BY store_id, created_at, id
      )
    SQL
  end

  def down
    remove_index :spree_pos_branches, name: 'index_spree_pos_branches_one_default_per_store'
    remove_column :spree_pos_branches, :is_default
  end
end
