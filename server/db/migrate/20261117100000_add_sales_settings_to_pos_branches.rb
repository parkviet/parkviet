# frozen_string_literal: true

# Per-branch selling options (stock display, oversell, notes, coupons, …).
# Empty means every key uses its default, so existing branches do not change.
class AddSalesSettingsToPosBranches < ActiveRecord::Migration[8.1]
  def change
    add_column :spree_pos_branches, :sales_settings, :jsonb, default: {}, null: false
    add_check_constraint :spree_pos_branches, "jsonb_typeof(sales_settings) = 'object'",
                         name: 'chk_pos_branches_sales_settings'
  end
end