# frozen_string_literal: true

module Spree
  module Pos
    module GuestOrders
      # Staff accept a guest's order: its items go onto the table's order
      # through the ordinary add command (Workspaces::AppendItems, priced
      # again there), under the identity of the person accepting, and what
      # was added goes to the kitchen (Kitchen::Send, only the new lines).
      # A pay-before counter order with no workspace yet opens its own dine-in
      # order at the guest's table first.
      module Accept
        COMMAND = 'guest_order.accept'

        module_function

        # @return [Hash] 'guest_order' and, when items were added, 'workspace'
        def call(guest_order:, staff:, key:, automatic: false, device: nil, prepaid: false)
          store = guest_order.store
          branch = guest_order.branch
          existing_workspace = guest_order.workspace
          payload = { 'command' => COMMAND, 'guest_order_id' => guest_order.prefixed_id, 'automatic' => automatic }
          authorize = if automatic && existing_workspace
                        -> { Deliveries::Assign.authorize!(existing_workspace, staff) }
                      else
                        -> { Guard.decide!(store, staff, branch) }
                      end
          CommandExecutor.call(store: store, actor: staff, key: key, payload: payload, workspace: existing_workspace,
                               authorize: authorize) do
            guest_order.lock!
            pending!(guest_order, prepaid: prepaid)
            Guard.require!(branch)
            workspace = guest_order.workspace
            if workspace && !Workspace::OPEN_STATUSES.include?(workspace.operational_status)
              next expire!(guest_order, staff)
            end

            kept, dropped = split(guest_order)
            next reject_unavailable!(guest_order, staff, dropped, automatic) if kept.empty?

            if workspace.nil?
              shift = Emenu::Qr.open_shift(branch)
              raise Conflict.new('No shift is open on the table register.', reason: 'no_open_shift') if shift.nil?

              resource = guest_order.resource
              resource.lock!
              workspace = Workspaces::Create.draft!(
                store: store, staff: staff, shift: shift,
                editor_digest: Workspace.editor_digest(SecureRandom.uuid),
                service_mode: 'dine_in', resource: resource,
                table_label: Tables::Guard.next_label(resource)
              )
            end

            emenu = GuestMenu.emenu?(branch)
            added = Workspaces::AppendItems.call(workspace: workspace, staff: staff, key: "#{key}:append", device: device,
                                                 append_batch_id: guest_order.append_batch_id, items: kept.map { |row| append_row(row) },
                                                 allow_hidden: emenu, allow_emenu: emenu, send_kitchen: false)
            tickets = Kitchen::Send.call(workspace: workspace, actor: staff, send_key: "guest_order:#{guest_order.prefixed_id}", device: device,
                                         scope: SaleLine.where(id: added['sale_line_ids'].map { |id| SaleLine.find_by_prefix_id!(id).id }))
            workspace.update!(revision: workspace.revision + 1) if tickets.any?
            guest_order.update!(workspace: workspace, status: 'accepted', decided_by: staff, decided_at: Time.current,
                                automatic: automatic || prepaid, items: outcomes(guest_order, dropped))
            AuditEntry.record!(store: store, actor: staff, action: 'guest_order.accept', subject: guest_order,
                               metadata: { workspace_id: workspace.prefixed_id, automatic: automatic, device_id: device&.prefixed_id,
                                           sale_line_ids: added['sale_line_ids'], kitchen_ticket_count: tickets.size,
                                           left_out: dropped.map { |row, reason, _| { variant_id: row['variant_id'], reason: reason } } })
            announce!(guest_order)
            { 'guest_order' => guest_order.to_pos, 'workspace' => workspace.reload.to_pos, 'kitchen_ticket_count' => tickets.size }
          end
        end

        def pending!(guest_order, prepaid: false)
          allowed = prepaid ? %w[awaiting_payment] : %w[pending]
          return if allowed.include?(guest_order.status)

          raise Conflict.new('This guest order was already decided.', reason: 'guest_order_decided', details: { status: guest_order.status })
        end

        # [[row, ...], [[row, reason], ...]]: items still on the guest menu
        # and not sold out, and the others.
        def split(guest_order)
          menu = GuestMenu.variants(guest_order.branch)
          kept = []
          dropped = []
          guest_order.items.each_with_index do |row, index|
            entry = menu[row['variant_id']]
            reason = if entry.nil? then 'item_unavailable'
                     elsif entry[:sold_out] then 'item_sold_out'
                     end
            reason ? dropped << [row, reason, index] : kept << row
          end
          [kept, dropped]
        end

        def append_row(row)
          { 'variant_id' => row['variant_id'], 'quantity' => row['quantity'], 'note' => row['note'],
            'modifiers' => Array(row['modifiers']).map { |pick| pick.slice('option_id', 'quantity') } }.compact
        end

        # Each item with what became of it: added, or left out and why.
        def outcomes(guest_order, dropped)
          reasons = dropped.to_h { |_, reason, index| [index, reason] }
          guest_order.items.each_with_index.map do |row, index|
            reasons[index] ? row.merge('outcome' => 'left_out', 'reason' => reasons[index]) : row.merge('outcome' => 'added')
          end
        end

        def reject_unavailable!(guest_order, staff, dropped, automatic)
          guest_order.update!(status: 'rejected', decided_by: staff, decided_at: Time.current, automatic: automatic,
                              reject_reason: dropped.any? { |_, reason, _| reason == 'item_sold_out' } ? 'item_sold_out' : 'item_unavailable',
                              items: outcomes(guest_order, dropped))
          AuditEntry.record!(store: guest_order.store, actor: staff, action: 'guest_order.reject', subject: guest_order,
                             metadata: { workspace_id: guest_order.workspace&.prefixed_id, reason: guest_order.reject_reason, automatic: automatic }.compact)
          announce!(guest_order)
          { 'guest_order' => guest_order.to_pos }
        end

        def expire!(guest_order, staff)
          guest_order.update!(status: 'expired', decided_by: staff, decided_at: Time.current)
          announce!(guest_order)
          { 'guest_order' => guest_order.to_pos }
        end

        def announce!(guest_order)
          Realtime.publish(guest_order.branch, 'guest_order.updated',
                           id: guest_order.prefixed_id,
                           refs: { workspace_id: guest_order.workspace&.prefixed_id, resource_id: guest_order.resource.prefixed_id }.compact)
        end
      end
    end
  end
end
