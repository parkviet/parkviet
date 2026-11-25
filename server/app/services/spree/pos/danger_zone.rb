# frozen_string_literal: true

module Spree
  module Pos
    # Destructive maintenance operations for Store Settings -> Danger Zone:
    # 1. reset_data: wipe transactional and/or catalog data for the whole store OR a single branch
    #    (always preserving staff accounts, roles, branch topology, and store/tax settings).
    # 2. delete_branch: permanently remove a single branch and all branch-scoped records
    #    (preserving staff accounts and all other branches).
    # 3. delete_store: wipe store data and soft-delete the store (refusing if it is the last active store).
    class DangerZone
      PRESERVED_TABLES = %w[
        spree_stores
        spree_admin_users
        spree_users
        spree_roles
        spree_role_users
        spree_pos_staff_roles
        spree_pos_store_infos
        spree_pos_store_profiles
        spree_pos_tax_profiles
        spree_pos_tax_regimes
        spree_pos_tax_rate_schedules
        spree_pos_einvoice_settings
        spree_pos_audit_entries
        spree_currencies
        spree_countries
        spree_states
        spree_zones
        spree_tax_categories
        spree_payment_methods
        spree_stock_locations
      ].freeze

      BRANCH_TRANSACTION_TABLES = %w[
        spree_pos_workspaces
        spree_pos_shifts
        spree_pos_cash_movements
        spree_pos_cash_movement_requests
        spree_pos_cash_reconciliations
        spree_pos_stock_documents
        spree_pos_inventory_adjustments
        spree_pos_inventory_lots
        spree_pos_stock_alerts
        spree_pos_stock_discrepancies
        spree_pos_fund_vouchers
        spree_pos_receivable_entries
        spree_pos_received_funds
        spree_pos_supplier_payments
        spree_pos_liability_payouts
        spree_pos_einvoices
        spree_pos_deliveries
        spree_pos_return_operations
        spree_pos_exchange_operations
        spree_pos_reservations
        spree_pos_kitchen_sends
        spree_pos_kitchen_tickets
        spree_pos_kitchen_voids
        spree_pos_bottle_keeps
        spree_pos_vehicle_visits
        spree_pos_timed_sessions
        spree_pos_tip_records
        spree_pos_tender_attempts
        spree_pos_approval_requests
        spree_pos_approvals
        spree_pos_credit_requests
        spree_pos_refund_requests
        spree_pos_payment_requests
        spree_pos_guest_orders
        spree_pos_guest_requests
        spree_pos_guest_sessions
        spree_pos_platform_orders
        spree_pos_print_jobs
        spree_pos_prebill_prints
        spree_pos_receipt_prints
        spree_pos_receipt_snapshots
        spree_pos_receipt_evidences
        spree_pos_payout_evidences
        spree_pos_attendant_assignments
        spree_pos_pour_events
        spree_pos_meal_swipes
        spree_pos_trace_enrollments
        spree_pos_stored_value_accounts
        spree_pos_payrolls
        spree_pos_owner_alerts
      ].freeze

      STORE_ONLY_TRANSACTION_TABLES = %w[
        spree_pos_tax_declarations
        spree_pos_tax_revenue_years
        spree_pos_export_requests
        spree_pos_payrolls
        spree_pos_fund_vouchers
        spree_pos_receivable_entries
        spree_pos_supplier_payments
        spree_pos_stock_documents
        spree_pos_shifts
        spree_pos_workspaces
      ].freeze

      BRANCH_CATALOG_TABLES = %w[
        spree_pos_branch_products
        spree_pos_emenu_categories
        spree_pos_menu_schedules
        spree_pos_menu_availabilities
        spree_pos_menu_favorites
        spree_pos_buffet_tiers
        spree_pos_collections
        spree_pos_timed_promotions
      ].freeze

      STORE_CATALOG_TABLES = %w[
        spree_pos_recipes
        spree_pos_combo_components
        spree_pos_product_modifier_groups
        spree_pos_product_settings
        spree_pos_variant_units
        spree_pos_units
        spree_pos_branch_products
      ].freeze

      class << self
        def reset_data(store:, actor:, scope:, branch_id: nil, wipe_transactions: true, wipe_catalog: false, confirmation: nil)
          scope = scope.to_s.presence || 'store'
          raise Spree::Pos::Conflict.new('Invalid reset scope.', reason: 'parameter_invalid') unless %w[store branch].include?(scope)

          wipe_tx = ActiveModel::Type::Boolean.new.cast(wipe_transactions)
          wipe_cat = ActiveModel::Type::Boolean.new.cast(wipe_catalog)
          if !wipe_tx && !wipe_cat
            raise Spree::Pos::Conflict.new('Select at least one data category to reset.', reason: 'parameter_invalid')
          end

          branch = scope == 'branch' ? resolve_branch!(store, branch_id) : nil
          target_name = branch ? branch.name : store_display_name(store)
          verify_confirmation!(confirmation, target_name)

          deleter = CascadeDeleter.new(preserved_tables: PRESERVED_TABLES + %w[spree_pos_branches spree_pos_registers spree_pos_devices spree_pos_staff_memberships])

          tx_count = 0
          cat_count = 0

          ActiveRecord::Base.transaction do
            if wipe_tx
              tx_count = if branch
                           wipe_branch_transactions!(deleter, store, branch)
                         else
                           wipe_store_transactions!(deleter, store)
                         end
            end

            if wipe_cat
              cat_count = if branch
                            wipe_branch_catalog!(deleter, branch)
                          else
                            wipe_store_catalog!(deleter, store)
                          end
            end

            record_audit!(
              store: store,
              actor: actor,
              action: 'danger_zone.reset_data',
              subject: branch || store,
              metadata: {
                scope: scope,
                branch_id: branch&.prefixed_id,
                wipe_transactions: wipe_tx,
                wipe_catalog: wipe_cat,
                deleted_transactions: tx_count,
                deleted_catalog: cat_count
              }
            )
          end

          {
            scope: scope,
            branch_id: branch&.prefixed_id,
            branch_name: branch&.name,
            wipe_transactions: wipe_tx,
            wipe_catalog: wipe_cat,
            deleted_counts: {
              transactions: tx_count,
              catalog: cat_count,
              total: tx_count + cat_count
            },
            preserved_staff: true
          }
        end

        def delete_branch(store:, actor:, branch_id:, confirmation: nil)
          branch = resolve_branch!(store, branch_id)
          verify_confirmation!(confirmation, branch.name)

          branch_prefixed_id = branch.prefixed_id
          branch_name = branch.name
          was_default = branch.is_default

          deleter = CascadeDeleter.new(preserved_tables: PRESERVED_TABLES)

          ActiveRecord::Base.transaction do
            wipe_branch_transactions!(deleter, store, branch)
            wipe_branch_catalog!(deleter, branch)

            # Clear optional self/branch pointers before deleting child topology records
            branch.update_columns(cup_label_printer_id: nil, table_register_id: nil, reservation_fee_product_id: nil)

            deleter.delete_records('spree_pos_branches', [branch.id])

            if was_default
              Spree::Pos::Branch.where(store_id: store.id, status: 'active').order(:created_at, :id).first&.update_columns(
                is_default: true,
                updated_at: Time.current
              )
            end

            record_audit!(
              store: store,
              actor: actor,
              action: 'danger_zone.delete_branch',
              subject: store,
              metadata: {
                deleted_branch_id: branch_prefixed_id,
                deleted_branch_name: branch_name
              }
            )
          end

          {
            deleted_branch_id: branch_prefixed_id,
            deleted_branch_name: branch_name,
            remaining_branches_count: Spree::Pos::Branch.where(store_id: store.id).count
          }
        end

        def delete_store(store:, actor:, confirmation: nil)
          target_name = store_display_name(store)
          verify_confirmation!(confirmation, target_name)

          other_store = Spree::Store.where(deleted_at: nil).where.not(id: store.id).order(:id).first
          if other_store.nil?
            raise Spree::Pos::Conflict.new('Cannot delete the only active store.', reason: 'last_store_cannot_be_deleted')
          end

          store_prefixed_id = store.prefixed_id
          deleter = CascadeDeleter.new(preserved_tables: PRESERVED_TABLES)

          ActiveRecord::Base.transaction do
            wipe_store_transactions!(deleter, store)
            wipe_store_catalog!(deleter, store)

            branch_ids = Spree::Pos::Branch.where(store_id: store.id).pluck(:id)
            if branch_ids.any?
              Spree::Pos::Branch.where(id: branch_ids).update_all(
                cup_label_printer_id: nil,
                table_register_id: nil,
                reservation_fee_product_id: nil
              )
              deleter.delete_records('spree_pos_branches', branch_ids)
            end

            other_store.update_columns(default: true, updated_at: Time.current) if store.default?
            store.update_columns(deleted_at: Time.current, default: false, updated_at: Time.current)

            record_audit!(
              store: other_store,
              actor: actor,
              action: 'danger_zone.delete_store',
              subject: other_store,
              metadata: {
                deleted_store_id: store_prefixed_id,
                deleted_store_name: target_name
              }
            )
          end

          {
            deleted_store_id: store_prefixed_id,
            deleted_store_name: target_name,
            next_store_id: other_store.prefixed_id
          }
        end

        private

        def resolve_branch!(store, branch_id)
          raise Spree::Pos::Conflict.new('Branch is required.', reason: 'parameter_invalid') if branch_id.blank?

          branch = Spree::Pos::Branch.for_store(store).find_by_prefix_id(branch_id) ||
                   Spree::Pos::Branch.for_store(store).find_by(id: branch_id)
          raise Spree::Pos::Conflict.new('Branch not found.', reason: 'not_found') unless branch

          branch
        end

        def store_display_name(store)
          Spree::Pos::StoreInfo.find_by(store_id: store.id)&.name.presence || store.name.to_s
        end

        def verify_confirmation!(confirmation, expected_name)
          expected = expected_name.to_s.strip
          return if expected.blank?

          provided = confirmation.to_s.strip
          return if provided.casecmp?(expected)

          raise Spree::Pos::Conflict.new(
            'Confirmation text does not match the target name.',
            reason: 'confirmation_mismatch'
          )
        end

        def wipe_branch_transactions!(deleter, store, branch)
          before = deleter.total_deleted
          order_ids = branch_order_ids(store, branch)

          BRANCH_TRANSACTION_TABLES.each do |table|
            next unless deleter.table_exists?(table) && deleter.column_exists?(table, 'branch_id')

            ids = deleter.select_ids(table, 'branch_id', [branch.id])
            deleter.delete_records(table, ids) if ids.any?
          end

          deleter.delete_records('spree_orders', order_ids) if order_ids.any?

          # Reset branch stock movements
          location_ids = [branch.stock_location_id, branch.receiving_stock_location_id].compact.uniq
          reset_stock_movements!(deleter, location_ids)

          deleter.total_deleted - before
        end

        def wipe_store_transactions!(deleter, store)
          before = deleter.total_deleted
          branch_ids = Spree::Pos::Branch.where(store_id: store.id).pluck(:id)

          if branch_ids.any?
            BRANCH_TRANSACTION_TABLES.each do |table|
              next unless deleter.table_exists?(table) && deleter.column_exists?(table, 'branch_id')

              ids = deleter.select_ids(table, 'branch_id', branch_ids)
              deleter.delete_records(table, ids) if ids.any?
            end
          end

          STORE_ONLY_TRANSACTION_TABLES.each do |table|
            next unless deleter.table_exists?(table) && deleter.column_exists?(table, 'store_id')

            ids = deleter.select_ids(table, 'store_id', [store.id])
            deleter.delete_records(table, ids) if ids.any?
          end

          order_ids = Spree::Order.where(store_id: store.id).pluck(:id)
          deleter.delete_records('spree_orders', order_ids) if order_ids.any?

          location_ids = Spree::StockLocation.where(store_id: store.id).pluck(:id)
          reset_stock_movements!(deleter, location_ids)

          deleter.total_deleted - before
        end

        def wipe_branch_catalog!(deleter, branch)
          before = deleter.total_deleted

          BRANCH_CATALOG_TABLES.each do |table|
            next unless deleter.table_exists?(table) && deleter.column_exists?(table, 'branch_id')

            ids = deleter.select_ids(table, 'branch_id', [branch.id])
            deleter.delete_records(table, ids) if ids.any?
          end

          location_ids = [branch.stock_location_id, branch.receiving_stock_location_id].compact.uniq
          zero_stock_levels!(location_ids)

          deleter.total_deleted - before
        end

        def wipe_store_catalog!(deleter, store)
          before = deleter.total_deleted
          branch_ids = Spree::Pos::Branch.where(store_id: store.id).pluck(:id)

          if branch_ids.any?
            BRANCH_CATALOG_TABLES.each do |table|
              next unless deleter.table_exists?(table) && deleter.column_exists?(table, 'branch_id')

              ids = deleter.select_ids(table, 'branch_id', branch_ids)
              deleter.delete_records(table, ids) if ids.any?
            end
          end

          STORE_CATALOG_TABLES.each do |table|
            next unless deleter.table_exists?(table) && deleter.column_exists?(table, 'store_id')

            ids = deleter.select_ids(table, 'store_id', [store.id])
            deleter.delete_records(table, ids) if ids.any?
          end

          # Nullify branch reservation_fee_product_id before deleting products
          Spree::Pos::Branch.where(store_id: store.id).update_all(reservation_fee_product_id: nil)

          product_ids = store_product_ids(store)
          deleter.delete_records('spree_products', product_ids) if product_ids.any?

          location_ids = Spree::StockLocation.where(store_id: store.id).pluck(:id)
          zero_stock_levels!(location_ids)

          deleter.total_deleted - before
        end

        def branch_order_ids(store, branch)
          ids = Set.new
          [
            ['spree_pos_workspaces', 'order_id'],
            ['spree_pos_deliveries', 'order_id'],
            ['spree_pos_einvoices', 'order_id'],
            ['spree_pos_return_operations', 'order_id'],
            ['spree_pos_stock_discrepancies', 'order_id'],
            ['spree_pos_bottle_keeps', 'source_order_id']
          ].each do |table, col|
            next unless ActiveRecord::Base.connection.data_source_exists?(table)

            quoted_table = ActiveRecord::Base.connection.quote_table_name(table)
            quoted_col = ActiveRecord::Base.connection.quote_column_name(col)
            rows = ActiveRecord::Base.connection.select_values(
              "SELECT DISTINCT #{quoted_col} FROM #{quoted_table} WHERE branch_id = #{branch.id.to_i} AND #{quoted_col} IS NOT NULL"
            )
            ids.merge(rows.map(&:to_i))
          end

          return [] if ids.empty?

          Spree::Order.where(store_id: store.id, id: ids.to_a).pluck(:id)
        end

        def store_product_ids(store)
          if ActiveRecord::Base.connection.column_exists?(:spree_products, :store_id)
            Spree::Product.unscoped.where(store_id: store.id).pluck(:id)
          elsif ActiveRecord::Base.connection.data_source_exists?(:spree_products_stores)
            ActiveRecord::Base.connection.select_values(
              "SELECT product_id FROM spree_products_stores WHERE store_id = #{store.id.to_i}"
            ).map(&:to_i)
          else
            []
          end
        end

        def reset_stock_movements!(deleter, location_ids)
          return if location_ids.empty? || !deleter.table_exists?('spree_stock_movements')

          if deleter.column_exists?('spree_stock_movements', 'stock_location_id')
            ids = deleter.select_ids('spree_stock_movements', 'stock_location_id', location_ids)
            deleter.delete_records('spree_stock_movements', ids) if ids.any?
          elsif deleter.column_exists?('spree_stock_movements', 'stock_level_id') && deleter.table_exists?('spree_stock_levels')
            level_ids = deleter.select_ids('spree_stock_levels', 'stock_location_id', location_ids)
            if level_ids.any?
              ids = deleter.select_ids('spree_stock_movements', 'stock_level_id', level_ids)
              deleter.delete_records('spree_stock_movements', ids) if ids.any?
            end
          end
        end

        def zero_stock_levels!(location_ids)
          return if location_ids.empty? || !ActiveRecord::Base.connection.data_source_exists?('spree_stock_levels')

          conn = ActiveRecord::Base.connection
          table = Arel::Table.new('spree_stock_levels')
          assignments = %w[count_on_hand allocated_count reserved_count incoming_count].filter_map do |col|
            [table[col], 0] if conn.column_exists?('spree_stock_levels', col)
          end
          return if assignments.empty?

          stmt = Arel::UpdateManager.new
          stmt.table(table)
          stmt.set(assignments)
          stmt.where(table['stock_location_id'].in(location_ids.map(&:to_i)))
          conn.update(stmt)
        end

        def record_audit!(store:, actor:, action:, subject:, metadata: {})
          return unless defined?(Spree::Pos::AuditEntry) && ActiveRecord::Base.connection.data_source_exists?('spree_pos_audit_entries')

          Spree::Pos::AuditEntry.create!(
            store: store,
            actor: actor,
            action: action,
            subject_type: subject.class.name,
            subject_id: subject.id,
            metadata: metadata
          )
        rescue StandardError
          # Do not fail destructive operation if optional audit schema differs
          nil
        end
      end

      # Walks PostgreSQL foreign keys dynamically so deleting root records never
      # hits PG::ForeignKeyViolation while strictly respecting preserved tables.
      class CascadeDeleter
        attr_reader :total_deleted

        def initialize(preserved_tables:)
          @conn = ActiveRecord::Base.connection
          @preserved = preserved_tables.to_set
          @tables = @conn.tables.to_set
          @columns_cache = {}
          @incoming_fks = build_incoming_fks
          @total_deleted = 0
        end

        def table_exists?(table)
          @tables.include?(table)
        end

        def column_exists?(table, column)
          columns_for(table).key?(column)
        end

        def select_ids(table, column, values)
          return [] if values.empty? || !table_exists?(table) || !column_exists?(table, column) || !column_exists?(table, 'id')

          arel_table = Arel::Table.new(table)
          query = arel_table.project(arel_table['id']).where(arel_table[column].in(values.map(&:to_i).uniq))
          @conn.select_values(query).map(&:to_i)
        end

        def delete_records(table, ids, visited_stack = Set.new)
          ids = ids.map(&:to_i).uniq
          return 0 if ids.empty? || !table_exists?(table) || @preserved.include?(table)

          stack_key = "#{table}:#{ids.sort.hash}"
          return 0 if visited_stack.include?(stack_key)

          visited_stack.add(stack_key)

          (@incoming_fks[table] || []).each do |fk|
            child_table = fk[:from_table]
            fk_col = fk[:column]

            if child_table == table
              nullify_column(child_table, fk_col, ids) if nullable?(child_table, fk_col)
              next
            end

            if @preserved.include?(child_table) || fk[:on_delete] == :nullify
              nullify_column(child_table, fk_col, ids) if nullable?(child_table, fk_col)
              next
            end

            if column_exists?(child_table, 'id')
              child_ids = select_ids(child_table, fk_col, ids)
              delete_records(child_table, child_ids, visited_stack) if child_ids.any?
            else
              delete_by_column(child_table, fk_col, ids)
            end
          end

          deleted = delete_by_column(table, 'id', ids)
          @total_deleted += deleted
          deleted
        ensure
          visited_stack&.delete(stack_key)
        end

        private

        def build_incoming_fks
          map = Hash.new { |h, k| h[k] = [] }
          @tables.each do |table|
            @conn.foreign_keys(table).each do |fk|
              map[fk.to_table] << {
                from_table: fk.from_table,
                column: fk.column,
                on_delete: fk.on_delete
              }
            end
          end
          map
        end

        def columns_for(table)
          @columns_cache[table] ||= @conn.columns(table).index_by(&:name)
        end

        def nullable?(table, column)
          col = columns_for(table)[column]
          col ? col.null : false
        end

        def nullify_column(table, column, ids)
          return if ids.empty?

          arel_table = Arel::Table.new(table)
          stmt = Arel::UpdateManager.new
          stmt.table(arel_table)
          stmt.set([[arel_table[column], nil]])
          stmt.where(arel_table[column].in(ids.map(&:to_i).uniq))
          @conn.update(stmt)
        end

        def delete_by_column(table, column, ids)
          return 0 if ids.empty?

          arel_table = Arel::Table.new(table)
          stmt = Arel::DeleteManager.new
          stmt.from(arel_table)
          stmt.where(arel_table[column].in(ids.map(&:to_i).uniq))
          @conn.delete(stmt)
        end
      end
    end
  end
end
