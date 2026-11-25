# frozen_string_literal: true

class CreateSpreePosPayrolls < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_payrolls do |t|
      t.references :store, null: false, index: true
      t.references :branch, null: true, index: true
      t.references :created_by, null: true, index: true
      t.string :code, limit: 32, null: false
      t.string :name, limit: 255, null: false
      t.string :period_label, limit: 80
      t.date :period_start, null: false
      t.date :period_end, null: false
      t.date :payroll_date, null: false
      t.string :status, limit: 20, null: false, default: 'draft'
      t.text :note
      t.decimal :total_gross, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_deductions, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_net, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_pit, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_bhxh, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_bhyt, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_bhtn, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_employer_cost, precision: 14, scale: 2, null: false, default: 0
      t.datetime :finalized_at
      t.timestamps
    end

    add_index :spree_pos_payrolls, [:store_id, :code], unique: true
    add_check_constraint :spree_pos_payrolls, "status IN ('draft', 'finalized')", name: 'chk_spree_pos_payrolls_status'

    create_table :spree_pos_payroll_lines do |t|
      t.references :payroll, null: false, foreign_key: { to_table: :spree_pos_payrolls, on_delete: :cascade }
      t.references :staff, null: false, index: true
      t.integer :position, null: false, default: 0
      t.decimal :piece_quantity, precision: 12, scale: 2, null: false, default: 0
      t.decimal :piece_amount, precision: 14, scale: 2, null: false, default: 0
      t.decimal :work_days, precision: 8, scale: 2, null: false, default: 0
      t.decimal :time_amount, precision: 14, scale: 2, null: false, default: 0
      t.decimal :paid_leave_days, precision: 8, scale: 2, null: false, default: 0
      t.decimal :paid_leave_amount, precision: 14, scale: 2, null: false, default: 0
      t.decimal :payroll_allowance, precision: 14, scale: 2, null: false, default: 0
      t.decimal :other_allowance, precision: 14, scale: 2, null: false, default: 0
      t.decimal :bonus, precision: 14, scale: 2, null: false, default: 0
      t.decimal :gross_amount, precision: 14, scale: 2, null: false, default: 0
      t.decimal :employee_bhxh, precision: 14, scale: 2, null: false, default: 0
      t.decimal :employee_bhyt, precision: 14, scale: 2, null: false, default: 0
      t.decimal :employee_bhtn, precision: 14, scale: 2, null: false, default: 0
      t.decimal :other_deduction, precision: 14, scale: 2, null: false, default: 0
      t.decimal :pit_tax, precision: 14, scale: 2, null: false, default: 0
      t.decimal :total_deductions, precision: 14, scale: 2, null: false, default: 0
      t.decimal :net_amount, precision: 14, scale: 2, null: false, default: 0
      t.decimal :employer_bhxh, precision: 14, scale: 2, null: false, default: 0
      t.decimal :employer_bhyt, precision: 14, scale: 2, null: false, default: 0
      t.decimal :employer_bhtn, precision: 14, scale: 2, null: false, default: 0
      t.string :note, limit: 255
      t.timestamps
    end

    add_index :spree_pos_payroll_lines, [:payroll_id, :staff_id], unique: true
  end
end
