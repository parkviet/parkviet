# frozen_string_literal: true

module Spree
  module Pos
    module GuestOrders
      # Staff turn a guest's order down with a reason the guest reads on
      # their phone. Nothing reaches the table's order.
      module Reject
        COMMAND = 'guest_order.reject'
        REASON_MAX = 200

        module_function

        def call(guest_order:, staff:, key:, reason:)
          note = reason.to_s.squish
          raise Conflict.new('A reason is required.', reason: 'reason_required') if note.blank?
          raise Conflict.new('Reason is too long.', reason: 'reason_invalid') if note.length > REASON_MAX

          store = guest_order.store
          branch = guest_order.branch
          payload = { 'command' => COMMAND, 'guest_order_id' => guest_order.prefixed_id, 'reason' => note }
          CommandExecutor.call(store: store, actor: staff, key: key, payload: payload,
                               authorize: -> { Guard.decide!(store, staff, branch) }) do
            guest_order.lock!
            Accept.pending!(guest_order)
            guest_order.update!(status: 'rejected', decided_by: staff, decided_at: Time.current, reject_reason: note)
            AuditEntry.record!(store: store, actor: staff, action: 'guest_order.reject', subject: guest_order,
                               metadata: { workspace_id: guest_order.workspace&.prefixed_id, reason: note, automatic: false }.compact)
            Accept.announce!(guest_order)
            { 'guest_order' => guest_order.to_pos }
          end
        end
      end
    end
  end
end
