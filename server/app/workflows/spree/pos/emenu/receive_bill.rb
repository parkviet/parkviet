# frozen_string_literal: true

module Spree
  module Pos
    module Emenu
      # A pay-later note (`TN<order number>`) for a table that is still open,
      # so there is no credit debt for ReceiveTransfer to collect. The money
      # is written on that table's order instead. A closed sale with no debt
      # stays unmatched.
      module ReceiveBill
        module_function

        def call(order:, amount:, transaction:, event:)
          return false if transaction.provider_transaction_id.blank?

          key = "emenu-bill:#{event.provider}:#{transaction.provider_transaction_id}"
          if CommandReceipt.exists?(store_id: order.store_id, idempotency_key: key)
            event.mark_status!('duplicate')
            return true
          end

          workspace = Workspace.where(order_id: order.id, operational_status: Workspace::OPEN_STATUSES).order(:id).first
          return false if workspace.nil?

          reference = transaction.bank_reference.presence || transaction.provider_transaction_id
          account = transaction.account_number.presence || event.receiving_account&.account_number
          booked = BookTablePayment.call(workspace: workspace, amount: amount, reference: reference, receiving_account: account,
                                         key: key, actor_note: PayLater.transfer_content(order))
          return false unless booked

          event.update!(matched_order_number: order.number, status: 'confirmed', error_message: nil, processed_at: Time.current)
          true
        end
      end
    end
  end
end
