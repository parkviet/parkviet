# frozen_string_literal: true

class AllowOnSaveKitchenSendTrigger < ActiveRecord::Migration[8.1]
  def up
    remove_check_constraint :spree_pos_branches, name: 'chk_pos_branches_kitchen_send_trigger'
    add_check_constraint :spree_pos_branches,
                         "kitchen_send_trigger IN ('on_complete', 'on_save', 'manual')",
                         name: 'chk_pos_branches_kitchen_send_trigger'
  end

  def down
    execute <<~SQL.squish
      UPDATE spree_pos_branches
      SET kitchen_send_trigger = 'manual'
      WHERE kitchen_send_trigger = 'on_save'
    SQL
    remove_check_constraint :spree_pos_branches, name: 'chk_pos_branches_kitchen_send_trigger'
    add_check_constraint :spree_pos_branches,
                         "kitchen_send_trigger IN ('on_complete', 'manual')",
                         name: 'chk_pos_branches_kitchen_send_trigger'
  end
end
