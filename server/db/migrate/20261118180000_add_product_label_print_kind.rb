# frozen_string_literal: true

# Product stickers are printed through a station as a job of their own kind.
# The printer roles are an array without a constraint, so only the print job
# kinds change.
class AddProductLabelPrintKind < ActiveRecord::Migration[8.1]
  OLD_KINDS = %w[receipt prebill kitchen_ticket void_ticket ready_ticket cup_label checklist table_qr test].freeze
  NEW_KINDS = (OLD_KINDS + %w[product_label]).freeze

  def up
    replace_constraint(NEW_KINDS)
  end

  def down
    execute "DELETE FROM spree_pos_print_jobs WHERE kind = 'product_label'"
    execute "UPDATE spree_pos_printers SET roles = array_remove(roles, 'product_label') WHERE 'product_label' = ANY(roles)"
    replace_constraint(OLD_KINDS)
  end

  private

  def replace_constraint(kinds)
    remove_check_constraint :spree_pos_print_jobs, name: 'chk_pos_print_jobs_kind'
    add_check_constraint :spree_pos_print_jobs, "kind IN (#{kinds.map { |kind| "'#{kind}'" }.join(', ')})",
                         name: 'chk_pos_print_jobs_kind'
  end
end
