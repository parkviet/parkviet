# frozen_string_literal: true

module Spree
  module Pos
    module Emenu
      # Books a bank transfer onto an open table order, through the same
      # receipt a confirmed VietQR tender writes (received funds, evidence,
      # a completed payment, an allocation). A transfer larger than the bill
      # keeps the extra on the receipt. One bank transaction is booked once.
      module BookTablePayment
        module_function

        # @return [Boolean] whether the transfer is on the order
        def call(workspace:, amount:, reference:, receiving_account:, key:, actor_note:)
          handed = BigDecimal(amount.to_s)
          return false unless handed.positive? && handed.frac.zero?

          shift = active_shift_for(workspace)
          staff = shift&.owner
          return false if staff.nil?

          payload = {
            'command' => 'emenu.book_payment', 'workspace_id' => workspace.prefixed_id,
            'amount' => handed.to_s('F'), 'reference' => reference.to_s
          }
          CommandExecutor.call(store: workspace.store, actor: staff, key: key, payload: payload, workspace: workspace,
                               authorize: -> {}) do
            current_shift = active_shift_for(workspace)
            raise Conflict.new('Shift is closed.', reason: 'shift_closed') if current_shift.nil?

            write_in_transaction!(workspace: workspace, shift: current_shift, staff: current_shift.owner || staff,
                                  handed: handed, reference: reference, receiving_account: receiving_account,
                                  actor_note: actor_note)
          end
          true
        rescue Conflict => e
          Rails.logger.info("[pos] emenu payment left unmatched: #{e.message}")
          false
        end

        def active_shift_for(workspace)
          return workspace.shift if workspace.shift&.open?

          Qr.open_shift(workspace.branch)
        end

        def write_in_transaction!(workspace:, shift:, staff:, handed:, reference:, receiving_account:, actor_note:)
          unless Workspace::OPEN_STATUSES.include?(workspace.operational_status)
            raise Conflict.new('This order is no longer open.', reason: 'workspace_closed')
          end

          ShiftBarrier.hold!(shift)
          if ReceiptReferenceGuard.duplicates(store: workspace.store, reference: reference, receiving_account: receiving_account).exists?
            raise Conflict.new('This bank reference was already recorded.', reason: 'duplicate_reference')
          end

          due = Qr.due(workspace)
          applied = [handed, due].min
          raise Conflict.new('There is nothing to pay.', reason: 'nothing_to_pay') unless applied.positive?

          resolver = PaymentMethodResolver.new(store: workspace.store)
          row = resolver.available(branch: workspace.branch).find { |candidate| candidate.kind == 'vietqr' }
          core = row && resolver.core_for(row)
          raise Conflict.new('VietQR is not available.', reason: 'vietqr_unavailable') if core.nil?

          method = Tenders::Prepare.persist_method!(row, core)
          order = workspace.order
          attempt = TenderAttempt.create!(
            store: workspace.store, workspace: workspace, branch: workspace.branch, register: shift.register,
            shift: shift, pos_payment_method: method, actor: staff, status: 'confirmed', confirmed_at: Time.current,
            amount: applied, order_total_snapshot: order.total, currency: order.currency, workspace_revision: workspace.revision,
            snapshot: { 'total' => order.total.to_s('F'), 'currency' => order.currency, 'source' => 'emenu' }
          )
          funds = ReceivedFunds.create!(
            store: workspace.store, workspace: workspace, branch: workspace.branch, register: shift.register,
            shift: shift, tender_attempt: attempt, actor: staff, kind: 'bank_manual', status: 'received',
            handed_amount: handed, applied_amount: applied, change_amount: 0, received_net: handed,
            currency: order.currency, reference: reference.presence, receiving_account: receiving_account.presence,
            received_at: Time.current
          )
          ReceiptEvidence.create!(
            store: workspace.store, tender_attempt: attempt, actor: staff, kind: 'vietqr_webhook',
            reference: reference.presence, receiving_account: receiving_account.presence, attested_at: Time.current
          )
          payment = order.payments.create!(payment_method: core, amount: applied)
          payment.complete!
          FundsAllocation.create!(
            store: workspace.store, received_funds: funds, workspace: workspace, order: order,
            payment: payment, status: 'active', amount: applied, currency: order.currency
          )
          workspace.update!(revision: workspace.revision + 1)
          AuditEntry.record!(store: workspace.store, actor: staff, action: 'emenu.payment', subject: workspace,
                             metadata: { workspace_id: workspace.prefixed_id, applied: applied.to_s('F'),
                                         handed: handed.to_s('F'), note: actor_note })
          OutboxEntry.record!(store: workspace.store, event_type: 'tender.confirmed', aggregate: funds,
                              payload: { 'funds_id' => funds.prefixed_id, 'workspace_id' => workspace.prefixed_id })
          Realtime.announce_workspaces([workspace.id])
          true
        end
      end
    end
  end
end
