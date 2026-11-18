# frozen_string_literal: true

# What one pick of an add-on option costs the store, for options whose cost
# no recipe or stocked variant already counts. A sold line keeps the copy it
# was sold with, as it keeps the option's price.
class AddCostPriceToPosModifierOptions < ActiveRecord::Migration[8.1]
  def change
    add_column :spree_pos_modifier_options, :cost_price, :decimal, precision: 10, scale: 2
    add_check_constraint :spree_pos_modifier_options, 'cost_price IS NULL OR cost_price >= 0', name: 'chk_pos_modifier_options_cost'
    add_column :spree_pos_line_modifiers, :cost_price, :decimal, precision: 10, scale: 2
    add_check_constraint :spree_pos_line_modifiers, 'cost_price IS NULL OR cost_price >= 0', name: 'chk_pos_line_modifiers_cost'
  end
end
