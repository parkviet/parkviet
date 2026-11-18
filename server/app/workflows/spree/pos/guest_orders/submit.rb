# frozen_string_literal: true

module Spree
  module Pos
    module GuestOrders
      # A guest sends items from their phone. In pay-after mode the items wait
      # as a pending guest order for staff (or auto-accept within limits). In
      # pay-before mode with VietQR, the order waits in `awaiting_payment`
      # until the bank webhook settles it onto its own dine-in order.
      module Submit
        MAX_ROWS = 20
        MAX_QUANTITY = 20
        MAX_ITEMS = 50

        module_function

        # @return [GuestOrder]
        def call(session:, key:, items:, payment: nil)
          key = key.to_s
          raise Conflict.new('Idempotency-Key is required.', reason: 'idempotency_key_required') if key.blank? || key.length > 200

          rows = normalize!(items)
          digest = Digest::SHA256.hexdigest(rows.to_json)
          fresh = false
          order = GuestOrder.transaction do
            session.lock!
            existing = GuestOrder.find_by(guest_session_id: session.id, idempotency_key: key)
            next replay!(existing, digest) if existing

            fresh = true
            create!(session, key, rows, digest, payment)
          end
          auto_accept(order) if fresh && order.status == 'pending' && EmenuSettings.of(order.branch)['payment_timing'] != 'pay_before'
          order.reload
        end

        def replay!(existing, digest)
          return existing if existing.request_digest == digest

          raise Conflict.new('Idempotency key was reused with different items.', reason: 'idempotency_key_reused')
        end

        def create!(session, key, rows, digest, payment)
          branch = session.branch
          Guard.require_open!(branch)
          session.resource.lock!
          Guard.interval!(branch, session.resource)
          raise Conflict.new('The table has no open order.', reason: 'table_closed') unless session.ordering?
          if GuestOrder.where(guest_session_id: session.id, status: %w[pending awaiting_payment]).count >= GuestOrder::MAX_PENDING
            raise Conflict.new('Wait until staff confirm your earlier orders.', reason: 'too_many_pending')
          end

          settings = EmenuSettings.of(branch)
          prepay = settings['payment_timing'] == 'pay_before'
          choice = pay_choice(branch, settings, payment)
          workspace = prepay ? nil : session.workspace
          currency = workspace&.order&.currency || branch.store.default_currency
          quoted = quote!(branch, workspace, currency, rows)
          status = choice == 'vietqr' && prepay ? 'awaiting_payment' : 'pending'
          order = GuestOrder.create!(
            store: session.store, branch: branch, guest_session: session, workspace: workspace, resource: session.resource,
            items: quoted, quoted_total: quoted.sum { |row| BigDecimal(row['amount']) }, currency: currency,
            item_count: quoted.sum { |row| row['quantity'] }, idempotency_key: key, request_digest: digest,
            append_batch_id: SecureRandom.uuid, status: status, pay_method: choice
          )
          if status == 'awaiting_payment'
            order.update!(payment_code: Emenu::Qr.code_for(order), payment_expires_at: Time.current + EmenuSettings.prepay_wait(branch, settings))
          else
            Realtime.publish(branch, 'guest_order.created',
                             id: order.prefixed_id,
                             refs: { workspace_id: workspace&.prefixed_id, resource_id: session.resource.prefixed_id }.compact)
          end
          order
        end

        # Pay-before needs a method the branch allows. Pay-after ignores one.
        def pay_choice(branch, settings, payment)
          return nil unless settings['payment_timing'] == 'pay_before'

          choice = payment.to_s
          raise Conflict.new('Choose how to pay.', reason: 'payment_required') unless settings['pay_methods'].include?(choice)
          if choice == 'vietqr' && PayLater.receiving_account(branch.store, branch).nil?
            raise Conflict.new('VietQR is not available.', reason: 'vietqr_unavailable')
          end

          choice
        end

        # Prices and names from the server's menu, with the options checked
        # against the item's groups (min, max, required).
        def quote!(branch, workspace, currency, rows)
          menu = GuestMenu.variants(branch)
          now = Workspace.business_now
          emenu = GuestMenu.emenu?(branch)
          rows.map do |row|
            item_row = menu[row['variant_id']]
            unless item_row
              raise Conflict.new('This item cannot be ordered here.', reason: 'item_unavailable', details: { variant_id: row['variant_id'] })
            end
            if item_row[:sold_out]
              raise Conflict.new('This item is sold out.', reason: 'item_sold_out', details: { menu_item_id: item_row[:id] })
            end

            variant = Spree::Variant.find_by_prefix_id(row['variant_id'])
            pricing = Menu::Pricing.resolve(branch: branch, variant: variant, selections: row['modifiers'] || [], now: now,
                                            note: row['note'], currency: currency, order: workspace&.order,
                                            allow_hidden: emenu)
            size = item_row[:variants].find { |entry| entry[:id] == row['variant_id'] }
            {
              'variant_id' => row['variant_id'], 'menu_item_id' => item_row[:id], 'name' => item_row[:name], 'size' => size[:name],
              'quantity' => row['quantity'], 'unit_price' => pricing.unit_price.to_s('F'),
              'amount' => (pricing.unit_price * row['quantity']).to_s('F'), 'note' => pricing.note,
              'modifiers' => pricing.options.map do |picked|
                { 'option_id' => picked.option.prefixed_id, 'name' => picked.option.name, 'quantity' => picked.quantity }
              end
            }
          end
        end

        def normalize!(items)
          unless items.is_a?(Array) && items.size.between?(1, MAX_ROWS)
            raise Conflict.new("Send between 1 and #{MAX_ROWS} items.", reason: 'guest_order_invalid')
          end

          rows = items.map do |item|
            raise Conflict.new('An item is invalid.', reason: 'guest_order_invalid') unless item.is_a?(Hash)

            item = item.to_h.stringify_keys
            quantity = item['quantity'].nil? ? 1 : integer(item['quantity'])
            variant_id = item['variant_id'].to_s
            unless quantity&.between?(1, MAX_QUANTITY) && variant_id.match?(/\A[a-z]+_[A-Za-z0-9]{1,40}\z/)
              raise Conflict.new('An item is invalid.', reason: 'guest_order_invalid')
            end
            raise Conflict.new('The note is too long.', reason: 'note_too_long') if item['note'].to_s.length > 200

            { 'variant_id' => variant_id, 'quantity' => quantity, 'modifiers' => modifiers!(item['modifiers']),
              'note' => item['note'].to_s.squish.presence }
          end
          raise Conflict.new("Order at most #{MAX_ITEMS} items at once.", reason: 'guest_order_invalid') if rows.sum { |row| row['quantity'] } > MAX_ITEMS

          rows
        end

        def modifiers!(value)
          return [] if value.nil?
          raise Conflict.new('Options are invalid.', reason: 'modifier_unknown') unless value.is_a?(Array) && value.size <= Menu::Pricing::MAX_SELECTIONS

          value.map do |pick|
            raise Conflict.new('Options are invalid.', reason: 'modifier_unknown') unless pick.is_a?(Hash)

            pick = pick.to_h.stringify_keys
            quantity = pick['quantity'].nil? ? 1 : integer(pick['quantity'])
            raise Conflict.new('Option quantity is invalid.', reason: 'modifier_max') unless quantity&.between?(1, ModifierGroup::MAX_OPTION_QUANTITY)

            { 'option_id' => pick['option_id'].to_s, 'quantity' => quantity }
          end
        end

        def integer(value)
          return value if value.is_a?(Integer)

          value.to_s.match?(/\A\d{1,3}\z/) ? Integer(value.to_s, 10) : nil
        end

        # Straight to the kitchen within the branch's limits; anything else,
        # or an order that cannot be added right now, waits for staff.
        def auto_accept(order)
          return if order.workspace.nil?

          branch = order.branch
          return unless branch.qr_order_mode == 'direct_to_kitchen' && branch.qr_order_auto_limit
          return if order.quoted_total > branch.qr_order_auto_limit || order.item_count > branch.qr_order_auto_max_items

          owner = order.workspace.shift.owner
          Accept.call(guest_order: order, staff: owner, key: "guest_order:auto:#{order.prefixed_id}", automatic: true)
        rescue Conflict, CanCan::AccessDenied => e
          Rails.logger.info({ event: 'pos.guest_order.auto_accept_skipped', guest_order: order.prefixed_id,
                              reason: e.respond_to?(:reason) ? e.reason : 'access_denied' }.to_json)
        end
      end
    end
  end
end
