# frozen_string_literal: true

module Spree
  module Pos
    module Emenu
      # Prepay orders whose transfer window has closed are canceled. The
      # table's order is left as it is: money that arrives afterwards stays
      # unmatched for staff.
      class ExpirePrepayJob < ApplicationJob
        queue_as :default

        def perform(limit: 200)
          ids = GuestOrder.where(status: 'awaiting_payment').where(payment_expires_at: ...Time.current).order(:id).limit(limit).pluck(:id)
          ids.each do |id|
            GuestOrder.transaction do
              order = GuestOrder.lock.find(id)
              next unless order.status == 'awaiting_payment' && order.payment_expires_at && order.payment_expires_at < Time.current

              order.update!(status: 'canceled', decided_at: Time.current, reject_reason: 'payment_expired')
            end
          rescue StandardError => e
            Rails.error.report(e, handled: true, context: { pos_guest_order_id: id })
          end
        end
      end
    end
  end
end
