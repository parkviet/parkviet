# frozen_string_literal: true

class AddReadyTicketPrintKind < ActiveRecord::Migration[8.1]
  OLD_KINDS = %w[receipt prebill kitchen_ticket void_ticket cup_label checklist table_qr test].freeze
  NEW_KINDS = %w[receipt prebill kitchen_ticket void_ticket ready_ticket cup_label checklist table_qr test].freeze

  def up
    remove_check_constraint :spree_pos_print_jobs, name: 'chk_pos_print_jobs_kind'
    add_check_constraint :spree_pos_print_jobs,
                         "kind IN (#{NEW_KINDS.map { |kind| "'#{kind}'" }.join(', ')})",
                         name: 'chk_pos_print_jobs_kind'
  end

  def down
    execute "DELETE FROM spree_pos_print_jobs WHERE kind = 'ready_ticket'"
    execute "UPDATE spree_pos_printers SET roles = array_remove(roles, 'ready_ticket') WHERE 'ready_ticket' = ANY(roles)"
    remove_check_constraint :spree_pos_print_jobs, name: 'chk_pos_print_jobs_kind'
    add_check_constraint :spree_pos_print_jobs,
                         "kind IN (#{OLD_KINDS.map { |kind| "'#{kind}'" }.join(', ')})",
                         name: 'chk_pos_print_jobs_kind'
  end
end
