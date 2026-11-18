# frozen_string_literal: true

module Spree
  module Pos
    module GuestOrders
      # A guest cancels their own unpaid prepay order (`awaiting_payment`), so
      # they can change their cart or pay at the counter instead. Once paid or
      # decided, the order cannot be canceled here.
      module Cancel
        module_function

        # @return [GuestOrder]
        def call(session:, order_id:)
          order = GuestOrder.find_by_prefix_id(order_id.to_s)
          raise ActiveRecord::RecordNotFound if order.nil? || order.guest_session_id != session.id

          GuestOrder.transaction do
            order.lock!
            next order if order.status == 'canceled'

            unless order.status == 'awaiting_payment'
              raise Conflict.new('This order was already decided.', reason: 'guest_order_decided', details: { status: order.status })
            end

            order.update!(status: 'canceled', decided_at: Time.current, reject_reason: 'guest_canceled')
            order
          end
        end
      end
    end
  end
end
