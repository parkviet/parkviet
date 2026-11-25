# frozen_string_literal: true

class CreatePosStockAndPartnerTables < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_partner_groups do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }
      t.string :kind, limit: 16, null: false
      t.string :name, limit: 120, null: false
      t.text :note
      t.timestamps
    end
    add_index :spree_pos_partner_groups, %i[store_id kind name], unique: true, name: 'idx_pos_partner_groups_unique'

    create_table :spree_pos_suppliers do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }
      t.references :partner_group, foreign_key: { to_table: :spree_pos_partner_groups }
      t.references :created_by, null: false, foreign_key: { to_table: :spree_admin_users }
      t.references :customer_profile, foreign_key: { to_table: :spree_pos_customers }
      t.string :code, limit: 32, null: false
      t.string :name, limit: 120, null: false
      t.string :phone, limit: 32
      t.string :normalized_phone, limit: 32
      t.string :email, limit: 254
      t.string :address, limit: 255
      t.string :tax_code, limit: 40
      t.string :invoice_company, limit: 160
      t.string :invoice_address, limit: 255
      t.string :bank_name, limit: 120
      t.string :bank_account, limit: 64
      t.jsonb :tags, default: [], null: false
      t.string :status, limit: 16, default: 'active', null: false
      t.decimal :opening_payable, precision: 19, scale: 4, default: 0, null: false
      t.boolean :also_customer, default: false, null: false
      t.text :note
      t.timestamps
    end
    add_index :spree_pos_suppliers, %i[store_id code], unique: true, name: 'idx_pos_suppliers_store_code'
    add_index :spree_pos_suppliers, %i[store_id normalized_phone], name: 'idx_pos_suppliers_store_phone'

    change_table :spree_pos_customers, bulk: true do |t|
      t.string :code, limit: 32
      t.references :partner_group, foreign_key: { to_table: :spree_pos_partner_groups }
      t.jsonb :tags, default: [], null: false
      t.string :status, limit: 16, default: 'active', null: false
      t.string :tax_code, limit: 40
      t.string :invoice_company, limit: 160
      t.string :invoice_address, limit: 255
      t.string :gender, limit: 16
      t.date :birthday
      t.boolean :also_supplier, default: false, null: false
      t.text :note
    end
    add_index :spree_pos_customers, %i[store_id code], unique: true, where: 'code IS NOT NULL', name: 'idx_pos_customers_store_code'

    create_table :spree_pos_stock_documents do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }
      t.references :branch, null: false, foreign_key: { to_table: :spree_pos_branches }
      t.references :supplier, foreign_key: { to_table: :spree_pos_suppliers }
      t.references :customer_profile, foreign_key: { to_table: :spree_pos_customers }
      t.references :actor, null: false, foreign_key: { to_table: :spree_admin_users }
      t.references :completed_by, foreign_key: { to_table: :spree_admin_users }
      t.references :canceled_by, foreign_key: { to_table: :spree_admin_users }
      t.string :code, limit: 32, null: false
      t.string :kind, limit: 16, null: false
      t.string :status, limit: 16, default: 'draft', null: false
      t.string :invoice_type, limit: 32
      t.string :invoice_number, limit: 64
      t.string :export_reason, limit: 32
      t.string :counterparty_name, limit: 120
      t.datetime :occurred_at, null: false
      t.decimal :subtotal, precision: 19, scale: 4, default: 0, null: false
      t.decimal :discount_amount, precision: 19, scale: 4, default: 0, null: false
      t.decimal :extra_cost, precision: 19, scale: 4, default: 0, null: false
      t.decimal :tax_rate, precision: 5, scale: 2, default: 0, null: false
      t.decimal :tax_amount, precision: 19, scale: 4, default: 0, null: false
      t.decimal :total_amount, precision: 19, scale: 4, default: 0, null: false
      t.decimal :paid_amount, precision: 19, scale: 4, default: 0, null: false
      t.string :payment_status, limit: 16, default: 'unpaid', null: false
      t.text :note
      t.datetime :completed_at
      t.datetime :canceled_at
      t.text :cancel_reason
      t.timestamps
    end
    add_index :spree_pos_stock_documents, %i[store_id code], unique: true, name: 'idx_pos_stock_docs_store_code'
    add_index :spree_pos_stock_documents, %i[branch_id kind occurred_at], name: 'idx_pos_stock_docs_branch_kind_time'

    create_table :spree_pos_stock_document_lines do |t|
      t.references :stock_document, null: false, foreign_key: { to_table: :spree_pos_stock_documents }
      t.references :variant, null: false, foreign_key: { to_table: :spree_variants }
      t.string :item_kind, limit: 16, default: 'product', null: false
      t.integer :quantity, default: 0, null: false
      t.integer :system_quantity
      t.integer :actual_quantity
      t.decimal :unit_cost, precision: 19, scale: 4, default: 0, null: false
      t.decimal :line_total, precision: 19, scale: 4, default: 0, null: false
      t.string :note, limit: 255
      t.timestamps
    end

    create_table :spree_pos_supplier_payments do |t|
      t.references :store, null: false, foreign_key: { to_table: :spree_stores }
      t.references :branch, null: false, foreign_key: { to_table: :spree_pos_branches }
      t.references :supplier, null: false, foreign_key: { to_table: :spree_pos_suppliers }
      t.references :stock_document, foreign_key: { to_table: :spree_pos_stock_documents }
      t.references :actor, null: false, foreign_key: { to_table: :spree_admin_users }
      t.decimal :amount, precision: 19, scale: 4, null: false
      t.string :payment_method, limit: 16, default: 'cash', null: false
      t.datetime :occurred_at, null: false
      t.text :note
      t.timestamps
    end
    add_index :spree_pos_supplier_payments, %i[supplier_id occurred_at], name: 'idx_pos_supplier_payments_time'
  end
end
