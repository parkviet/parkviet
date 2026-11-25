# frozen_string_literal: true

class CreateSpreePosTaxDeclarations < ActiveRecord::Migration[8.1]
  def change
    create_table :spree_pos_tax_declarations do |t|
      t.bigint :store_id, null: false
      t.string :code, limit: 48, null: false
      t.string :declaration_type, limit: 24, null: false
      t.string :period_type, limit: 16, null: false, default: 'quarter'
      t.integer :period_year, null: false
      t.integer :period_number, null: false
      t.date :from_date, null: false
      t.date :to_date, null: false
      t.string :status, limit: 24, null: false, default: 'draft'
      t.jsonb :options, null: false, default: {}
      t.jsonb :summary, null: false, default: {}
      t.jsonb :taxpayer_snapshot, null: false, default: {}
      t.text :note
      t.datetime :submitted_at
      t.datetime :accepted_at
      t.bigint :created_by_id
      t.bigint :updated_by_id

      t.timestamps
    end

    add_index :spree_pos_tax_declarations, :store_id
    add_index :spree_pos_tax_declarations, %i[store_id code], unique: true
    add_index :spree_pos_tax_declarations, %i[store_id declaration_type period_year period_number],
              name: 'idx_pos_tax_declarations_store_type_period'
  end
end
