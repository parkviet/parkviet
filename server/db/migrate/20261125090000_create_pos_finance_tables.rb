# frozen_string_literal: true

class CreatePosFinanceTables < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_fund_accounts do |t|
      t.bigint :store_id, null: false
      t.bigint :branch_id, null: false
      t.string :name, null: false, limit: 120
      t.string :kind, null: false, default: 'cash', limit: 32
      t.string :bank_name, limit: 120
      t.string :account_number, limit: 64
      t.string :currency, null: false, default: 'VND', limit: 8
      t.decimal :opening_balance, precision: 14, scale: 2, null: false, default: 0
      t.string :status, null: false, default: 'active', limit: 32
      t.boolean :is_default, null: false, default: false
      t.bigint :created_by_id, null: false
      t.bigint :updated_by_id, null: false
      t.timestamps
    end

    add_index :spree_pos_fund_accounts, [:store_id, :branch_id]
    add_index :spree_pos_fund_accounts, [:branch_id, :name], unique: true
    add_foreign_key :spree_pos_fund_accounts, :spree_stores, column: :store_id
    add_foreign_key :spree_pos_fund_accounts, :spree_pos_branches, column: :branch_id

    create_table :spree_pos_fund_vouchers do |t|
      t.bigint :store_id, null: false
      t.bigint :branch_id, null: false
      t.bigint :fund_account_id, null: false
      t.bigint :target_fund_account_id
      t.string :code, null: false, limit: 32
      t.string :kind, null: false, limit: 32
      t.string :status, null: false, default: 'completed', limit: 32
      t.decimal :amount, precision: 14, scale: 2, null: false
      t.string :currency, null: false, default: 'VND', limit: 8
      t.string :category_code, null: false, default: 'other_expense', limit: 64
      t.string :category_label, limit: 120
      t.boolean :tax_deductible, null: false, default: true
      t.string :counterparty_name, limit: 120
      t.bigint :customer_profile_id
      t.string :reference, limit: 120
      t.text :note
      t.datetime :occurred_at, null: false
      t.bigint :actor_id, null: false
      t.bigint :voided_by_id
      t.datetime :voided_at
      t.string :void_reason, limit: 200
      t.timestamps
    end

    add_index :spree_pos_fund_vouchers, [:store_id, :code], unique: true
    add_index :spree_pos_fund_vouchers, [:store_id, :branch_id, :occurred_at], name: 'idx_pos_fund_vouchers_branch_occurred'
    add_index :spree_pos_fund_vouchers, :fund_account_id
    add_index :spree_pos_fund_vouchers, :target_fund_account_id
    add_foreign_key :spree_pos_fund_vouchers, :spree_stores, column: :store_id
    add_foreign_key :spree_pos_fund_vouchers, :spree_pos_branches, column: :branch_id
    add_foreign_key :spree_pos_fund_vouchers, :spree_pos_fund_accounts, column: :fund_account_id
    add_foreign_key :spree_pos_fund_vouchers, :spree_pos_fund_accounts, column: :target_fund_account_id
    add_foreign_key :spree_pos_fund_vouchers, :spree_pos_customers, column: :customer_profile_id

    add_column :spree_pos_credit_accounts, :promised_pay_on, :date
  end
end
