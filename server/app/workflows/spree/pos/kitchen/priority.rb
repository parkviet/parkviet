# frozen_string_literal: true

module Spree
  module Pos
    module Kitchen
      # Marks dishes urgent on the kitchen board. Staff raise it (at the
      # counter on a sale line, or in the kitchen on one item or a whole
      # ticket) and a recall raises it by itself, because the guest is
      # already waiting. Only items still to make (new, preparing) can
      # change; a dish that is ready, served or voided keeps what it had.
      # The person (or screen) and the time are kept on the item. Asking for
      # the value an item already has changes nothing.
      module Priority
        module_function

        # @return [KitchenTicketItem]
        def set_item(item:, priority:, actor:)
          flag = flag!(priority)
          changed = KitchenTicketItem.transaction do
            item.lock!
            unless item.open?
              raise Conflict.new("A #{item.status} item cannot be marked as a priority.", reason: 'kitchen_status_invalid',
                                                                                           details: { status: item.status })
            end

            mark!(item, flag, actor, Workspace.database_now)
          end
          publish(item.kitchen_ticket) if changed
          item
        end

        # Every item of the ticket still to make.
        # @return [KitchenTicket]
        def set_ticket(ticket:, priority:, actor:)
          flag = flag!(priority)
          changed = KitchenTicketItem.transaction do
            now = Workspace.database_now
            items = KitchenTicketItem.where(kitchen_ticket_id: ticket.id, status: KitchenTicketItem::OPEN).order(:id).lock.to_a
            items.map { |item| mark!(item, flag, actor, now) }.any?
          end
          publish(ticket) if changed
          ticket.items.reset
          ticket
        end

        # The items of a sale line the kitchen is still making follow the
        # line, inside the caller's transaction.
        def follow_line!(sale_line, flag, actor)
          now = Workspace.database_now
          items = KitchenTicketItem.joins(:kitchen_ticket).where(sale_line_id: sale_line.id, status: KitchenTicketItem::OPEN,
                                                                 spree_pos_kitchen_tickets: { kind: 'fire' }).
                  includes(:kitchen_ticket).order(:id).lock('FOR UPDATE OF spree_pos_kitchen_ticket_items').to_a
          items.select { |item| mark!(item, flag, actor, now) }.map(&:kitchen_ticket).uniq.each { |ticket| publish(ticket) }
        end

        def mark!(item, flag, actor, now)
          return false if item.priority == flag

          item.update!(priority: flag, priority_at: flag ? now : nil, priority_by: flag ? actor : nil)
          true
        end

        def flag!(value)
          return value if [true, false].include?(value)

          case value.to_s.downcase
          when 'true', '1' then true
          when 'false', '0' then false
          else raise Conflict.new('Priority must be true or false.', reason: 'kitchen_priority_invalid')
          end
        end

        def publish(ticket)
          Realtime.publish(ticket.branch, 'kitchen_ticket.updated',
                           id: ticket.prefixed_id, refs: { workspace_id: ticket.workspace.prefixed_id,
                                                           kitchen_station_id: ticket.kitchen_station.prefixed_id })
        end
      end
    end
  end
end
