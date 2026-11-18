# frozen_string_literal: true

# Product labels live in the receipt template store: a new document type and
# the label stocks they print on. The branch assignment table has no check
# constraint on its document type, so only the template table changes.
class AddProductLabelToPosReceiptTemplates < ActiveRecord::Migration[8.1]
  OLD_DOCUMENT_TYPES = %w[sale prebill payment_ticket return refund shift_closure].freeze
  NEW_DOCUMENT_TYPES = (OLD_DOCUMENT_TYPES + %w[product_label]).freeze
  OLD_PAPERS = %w[58mm 80mm a4 a5 a6].freeze
  LABEL_PAPERS = %w[
    roll_50x30 roll_40x30 roll_75x25_2 roll_72x22_2 roll_110x22_3
    sheet_a4_100 sheet_a4_65 sheet_a4_180 sheet_a5_40
  ].freeze
  NEW_PAPERS = (OLD_PAPERS + LABEL_PAPERS).freeze

  def up
    replace_constraints(NEW_DOCUMENT_TYPES, NEW_PAPERS)
  end

  def down
    label_templates = "SELECT id FROM spree_pos_receipt_templates WHERE document_type = 'product_label'"
    execute "DELETE FROM spree_pos_branch_receipt_templates WHERE document_type = 'product_label'"
    execute "DELETE FROM spree_pos_receipt_template_versions WHERE receipt_template_id IN (#{label_templates})"
    execute "DELETE FROM spree_pos_receipt_templates WHERE document_type = 'product_label'"
    replace_constraints(OLD_DOCUMENT_TYPES, OLD_PAPERS)
  end

  private

  def replace_constraints(document_types, papers)
    remove_check_constraint :spree_pos_receipt_templates, name: 'chk_pos_receipt_templates_document_type'
    remove_check_constraint :spree_pos_receipt_templates, name: 'chk_pos_receipt_templates_paper'
    add_check_constraint :spree_pos_receipt_templates, "document_type IN (#{quoted_list(document_types)})",
                         name: 'chk_pos_receipt_templates_document_type'
    add_check_constraint :spree_pos_receipt_templates, "paper IN (#{quoted_list(papers)})",
                         name: 'chk_pos_receipt_templates_paper'
  end

  def quoted_list(values)
    values.map { |value| "'#{value}'" }.join(', ')
  end
end
