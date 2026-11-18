# frozen_string_literal: true

module Spree
  module Pos
    # What a guest's phone shows of its table: the items on the table's
    # order with their kitchen state and the price list subtotal, this
    # phone's own orders and open requests. Never who added an item, a
    # discount, a payment or anything of other tables. Play time is shown
    # without an amount: it is priced when the bill is made.
    module GuestTable
      module_function

      def call(session)
        if session.workspace_id.present? && session.order_open?
          table_view(session, [session.workspace], open_bill: true)
        elsif session.prepay_mode?
          ids = session.guest_orders.where.not(workspace_id: nil).order(:id).pluck(:workspace_id).uniq
          workspaces = ids.empty? ? [] : Workspace.where(id: ids).order(:id).to_a
          table_view(session, workspaces, open_bill: false)
        else
          empty_view(session)
        end
      end

      def table_view(session, workspaces, open_bill:)
        ids = workspaces.map(&:id)
        all_lines = workspaces.flat_map { |workspace| lines(workspace) }
        open_due = if open_bill && workspaces.first
                     [Emenu::Qr.due(workspaces.first), BigDecimal('0')].max
                   else
                     workspaces.select { |ws| Workspace::OPEN_STATUSES.include?(ws.operational_status) }.
                       sum(BigDecimal('0')) { |ws| [Emenu::Qr.due(ws), BigDecimal('0')].max }
                   end
        {
          lines: all_lines,
          subtotal: ids.empty? ? nil : subtotal(ids),
          paid: ids.empty? ? '0.0' : paid(ids),
          due: open_due.to_s('F'),
          has_timed: ids.any? && SaleLine.where(workspace_id: ids, kind: Timed::Lines::KIND).exists?,
          orders: session.guest_orders.includes(:workspace).order(created_at: :desc).limit(20).map(&:to_guest),
          requests: session.guest_requests.still_open.order(:id).map(&:to_guest)
        }
      end

      def empty_view(session)
        {
          lines: [], subtotal: nil, paid: '0.0', due: '0.0', has_timed: false,
          orders: session.guest_orders.includes(:workspace).order(created_at: :desc).limit(20).map(&:to_guest),
          requests: session.guest_requests.still_open.order(:id).map(&:to_guest)
        }
      end

      def lines(workspace)
        kitchen = workspace.kitchen_status_by_line
        SaleLine.where(workspace_id: workspace.id).where.not(kind: Timed::Lines::KIND).includes(:line_modifiers, variant: :product).
          order(:id).map do |line|
            {
              name: line.variant.product.name, size: line.variant.options_text.presence, quantity: line.sale_quantity.to_s('F'),
              options: line.line_modifiers.map(&:name), amount: (line.unit_price * line.sale_quantity).round(4).to_s('F'),
              kitchen: kitchen_state(line, kitchen[line.id])
            }
          end
      end

      def subtotal(workspace_ids)
        SaleLine.where(workspace_id: workspace_ids).where.not(kind: Timed::Lines::KIND).sum('unit_price * sale_quantity').to_d.to_s('F')
      end

      def paid(workspace_ids)
        FundsAllocation.where(workspace_id: workspace_ids, status: 'active').sum(:amount).to_d.to_s('F')
      end

      # The least advanced state of the line's units: waiting (not sent yet),
      # sent, preparing, ready or served.
      def kitchen_state(line, counts)
        return 'waiting' if line.kitchen_sent_quantity.zero?

        counts ||= {}
        %w[new preparing ready served].each do |status|
          return status == 'new' ? 'sent' : status if counts.key?(status)
        end
        'sent'
      end
    end
  end
end
