# frozen_string_literal: true

# Staff mark a dish as urgent; the flag follows the line onto the kitchen
# ticket, with who raised it and when.
class AddPriorityToPosKitchenItems < ActiveRecord::Migration[8.1]
  def change
    add_column :spree_pos_sale_lines, :priority, :boolean, default: false, null: false
    change_table :spree_pos_kitchen_ticket_items, bulk: true do |t|
      t.boolean :priority, default: false, null: false
      t.datetime :priority_at
      t.string :priority_by_type
      t.bigint :priority_by_id
    end
    add_index :spree_pos_kitchen_ticket_items, :kitchen_ticket_id, where: 'priority',
                                                                   name: 'index_spree_pos_kitchen_ticket_items_on_priority_ticket'
  end
end
