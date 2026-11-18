# frozen_string_literal: true

module Spree
  module Pos
    module Emenu
      # A transfer whose note is an electronic-menu prepay code (`EM<id>`).
      # Each prepay order settles on its own dine-in order at the guest's
      # table, completes immediately when covered, and goes straight to the
      # kitchen; a second round at the same table makes its own order without
      # locking the first. A late or short transfer stays unmatched for staff.
      module ReceivePrepay
        module_function

        def call(transaction:, webhook_event:, payment_method:)
          id = Qr.guest_order_id(transaction.raw_content)
          return false if id.nil? || transaction.provider_transaction_id.blank?

          guest_order = GuestOrder.find_by(id: id)
          return false if guest_order.nil? || guest_order.store_id != payment_method&.store_id

          key = "emenu-prepay:#{webhook_event.provider}:#{transaction.provider_transaction_id}"
          if CommandReceipt.exists?(store_id: guest_order.store_id, idempotency_key: key)
            webhook_event.mark_status!('duplicate')
            return true
          end

          return false unless guest_order.status == 'awaiting_payment'
          return false if guest_order.payment_expires_at && Time.current > guest_order.payment_expires_at

          amount = BigDecimal(transaction.amount_cents.to_i.to_s)
          return false unless amount.positive? && amount >= guest_order.quoted_total

          settle!(guest_order, amount, transaction, webhook_event, key)
        rescue Conflict => e
          Rails.logger.info("[pos] emenu prepay #{webhook_event.prefixed_id} left unmatched: #{e.message}")
          false
        end

        def settle!(guest_order, amount, transaction, event, key)
          shift = Qr.open_shift(guest_order.branch)
          staff = shift&.owner
          return false if shift.nil? || staff.nil?

          reference = transaction.bank_reference.presence || transaction.provider_transaction_id
          account = transaction.account_number.presence || event.receiving_account&.account_number
          payload = {
            'command' => 'emenu.receive_prepay', 'guest_order_id' => guest_order.prefixed_id,
            'amount' => amount.to_s('F'), 'reference' => reference.to_s
          }
          CommandExecutor.call(store: guest_order.store, actor: staff, key: key, payload: payload, authorize: -> {}) do
            guest_order.lock!
            GuestOrders::Accept.pending!(guest_order, prepaid: true)
            GuestOrders::Guard.require!(guest_order.branch)
            kept, dropped = GuestOrders::Accept.split(guest_order)
            raise Conflict.new('Items are no longer available.', reason: 'item_unavailable') if kept.empty?

            editor = SecureRandom.uuid
            resource = guest_order.resource
            resource.lock!
            workspace = Workspaces::Create.draft!(
              store: guest_order.store, staff: staff, shift: shift,
              editor_digest: Workspace.editor_digest(editor),
              service_mode: 'dine_in', resource: resource,
              table_label: Tables::Guard.next_label(resource)
            )
            emenu = GuestMenu.emenu?(guest_order.branch)
            added = Workspaces::AppendItems.call(
              workspace: workspace, staff: staff, key: "#{key}:append",
              append_batch_id: guest_order.append_batch_id,
              items: kept.map { |row| GuestOrders::Accept.append_row(row) },
              allow_hidden: emenu, allow_emenu: emenu, send_kitchen: false
            )
            workspace.reload
            BookTablePayment.write_in_transaction!(
              workspace: workspace, shift: shift, staff: staff, handed: amount,
              reference: reference, receiving_account: account, actor_note: Qr.code_for(guest_order)
            )
            workspace.reload
            if Qr.due(workspace) <= 0
              Workspaces::Complete.call(
                workspace: workspace, staff: staff, revision: workspace.revision,
                lease_generation: workspace.lease_generation, editor_id: editor, key: "#{key}:complete"
              )
            end
            tickets = Kitchen::Send.call(
              workspace: workspace.reload, actor: staff,
              send_key: "guest_order:#{guest_order.prefixed_id}", buffet: false
            )
            guest_order.update!(
              workspace: workspace, status: 'accepted', prepaid: true, automatic: true,
              decided_by: staff, decided_at: Time.current, items: GuestOrders::Accept.outcomes(guest_order, dropped)
            )
            AuditEntry.record!(
              store: workspace.store, actor: staff, action: 'guest_order.accept', subject: guest_order,
              metadata: {
                workspace_id: workspace.prefixed_id, automatic: true, prepaid: true,
                sale_line_ids: added['sale_line_ids'], kitchen_ticket_count: tickets.size,
                left_out: dropped.map { |row, reason, _| { variant_id: row['variant_id'], reason: reason } }
              }
            )
            GuestOrders::Accept.announce!(guest_order)
            { 'guest_order_id' => guest_order.prefixed_id, 'workspace_id' => workspace.prefixed_id }
          end

          event.update!(matched_order_number: guest_order.reload.workspace.order.number, status: 'confirmed',
                        error_message: nil, processed_at: Time.current)
          true
        end
      end
    end
  end
end
