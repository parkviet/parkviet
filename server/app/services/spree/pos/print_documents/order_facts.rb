# frozen_string_literal: true

module Spree
  module Pos
    module PrintDocuments
      # Shared order facts read identically by `ReceiptBuilder` (when freezing
      # a completed sale snapshot) and `Workspace#to_pos` / `Prebill` (when
      # printing an open order). Every helper can be called through `.safe` so
      # an unexpected error omits that key and logs it instead of aborting the
      # checkout transaction.
      module OrderFacts
        module_function

        def safe(key, context = {})
          yield
        rescue StandardError => e
          Rails.error.report(e, handled: true, context: context.merge(order_fact: key))
          nil
        end

        def money(value)
          BigDecimal((value || 0).to_s).to_s('F')
        end

        # `{ 'name' => ..., 'area' => ... }` when the order sits at a table/room.
        def table(workspace)
          resource = workspace.resource
          return nil if resource.nil?

          name = resource.name.to_s.strip.presence
          return nil if name.nil?

          { 'name' => name, 'area' => resource.area&.name.to_s.strip.presence }.compact
        end

        def check_in_at(workspace)
          workspace.created_at&.iso8601
        end

        def order_source(workspace)
          workspace.order_source.to_s.strip.presence
        end

        def barcode(variant)
          variant&.barcode.to_s.strip.presence
        end

        def line_note(sale_line)
          sale_line&.note.to_s.strip.presence
        end

        # List price per sale unit when it differs from the sold `unit_price`.
        # Menu lines include option deltas so paid toppings do not look like a
        # price override; timed play-time lines have no list price.
        def original_price(variant:, sale_line:, line_price:, store:, order:)
          return nil if variant.nil? || sale_line&.kind == Timed::Lines::KIND

          base_list = SalesChannel.price(variant, store: store, currency: order.currency, order: order,
                                                   quantity: SalesChannel.line_quantity(sale_line) || 1)&.amount
          return nil if base_list.nil? || base_list <= 0

          list = if sale_line&.kind == SaleLineKinds::Menu::KIND
                   base_list + sale_line.line_modifiers.sum(BigDecimal('0')) { |row| row.price_delta * row.quantity }
                 else
                   BigDecimal(base_list.to_s)
                 end
          sold = BigDecimal((sale_line ? sale_line.unit_price : line_price).to_s)
          list != sold ? money(list) : nil
        end

        # Total quantity of goods/dishes on the order; timed room sessions are
        # excluded because their quantity is a session count, not an item count.
        def item_count(line_pairs)
          total = BigDecimal('0')
          counted = false
          line_pairs.each do |line, sale_line|
            next if sale_line&.kind == Timed::Lines::KIND

            qty = sale_line ? BigDecimal(sale_line.sale_quantity.to_s) : BigDecimal(line.quantity.to_s)
            next unless qty.positive?

            total += qty
            counted = true
          end
          counted ? total.to_s('F').delete_suffix('.0') : nil
        end

        # Per-promotion breakdown from `order.discounts`, grouped so a
        # promotion allocated across several lines prints once.
        def promotions(order)
          grouped = {}
          order.discounts.to_a.each do |discount|
            amount = BigDecimal(discount.amount.to_s).abs
            next unless amount.positive?

            name = discount.label.to_s.strip.presence
            key = [discount.promotion_id, name]
            entry = (grouped[key] ||= { name: name, amount: BigDecimal('0') })
            entry[:amount] += amount
          end
          grouped.values.map do |entry|
            { 'name' => entry[:name], 'amount' => money(entry[:amount]) }.compact
          end
        end

        # `{ 'previous' => ..., 'total' => ... }` from `ReceivableProjection`
        # at completion time. Subtracts this order's own open balance so
        # `previous` never double-counts a credit sale whose debit was written
        # earlier in the same transaction (or when `for_source!` runs late).
        def customer_debt(workspace)
          profile = workspace.pos_customer
          return nil if profile.nil?

          currency = workspace.order.currency
          account_ids = CreditAccount.where(
            store_id: workspace.store_id,
            customer_profile_id: profile.id,
            currency: currency
          ).select(:id)
          projection = ReceivableProjection.new(
            ReceivableEntry.where(credit_account_id: account_ids),
            today: Date.current
          )
          open_rows = projection.order_rows(status: 'open').to_a
          total = open_rows.sum(BigDecimal('0')) { |row| BigDecimal(row.balance.to_s) }
          this_order = open_rows.select { |row| row.order_id == workspace.order_id }.
                       sum(BigDecimal('0')) { |row| BigDecimal(row.balance.to_s) }
          previous = [total - this_order, BigDecimal('0')].max
          { 'previous' => money(previous), 'total' => money(total) }
        end

        # VietQR transfer payload for `remaining_amount` into the branch's
        # receiving account. When `remaining_amount` is zero (already paid in
        # full), emits a static account QR without an amount. Returns nil when
        # no receiving account is configured.
        def transfer_qr(workspace, remaining_amount:)
          order = workspace.order
          return nil unless order.currency == PayLater::CURRENCY

          account = PayLater.receiving_account(workspace.store, workspace.branch)
          return nil if account.nil?

          remaining = [BigDecimal((remaining_amount || 0).to_s), BigDecimal('0')].max
          return nil if remaining.frac.nonzero?

          whole = remaining.to_i
          note = order.number.to_s
          content = defined?(SpreeVietqr) ? SpreeVietqr::TransferContent.with_suffix(note) : note
          bank_name = account.bank_name.presence ||
                      (defined?(SpreeVietqr) && SpreeVietqr::PaymentInfo::BANK_NAMES[account.bank_bin]) ||
                      nil
          {
            'value' => PayLater.payload(
              bank_bin: account.bank_bin,
              account_number: account.account_number,
              amount: whole.positive? ? whole : nil,
              content: content
            ),
            'bank' => bank_name,
            'account_number' => account.account_number,
            'account_name' => account.account_name,
            'amount' => whole.positive? ? remaining.to_s('F') : nil,
            'currency' => PayLater::CURRENCY,
            'transfer_content' => content
          }.compact
        end
      end
    end
  end
end
