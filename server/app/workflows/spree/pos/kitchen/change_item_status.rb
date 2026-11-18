# frozen_string_literal: true

module Spree
  module Pos
    module Kitchen
      # Moves kitchen items along new → preparing → ready → served. A recall
      # takes a ready or served item back to preparing within 30 minutes; a
      # bump makes every open item of a ticket ready; an all-day bump makes
      # the oldest open items of one dish ready, first sent first. Asking for
      # the status an item already has changes nothing, so a screen that
      # retries a tap is safe; any other move that is not listed is refused.
      # Times come from the database clock, never the device. An item that
      # becomes ready keeps how long it took and whether that was past its
      # station's red threshold, for the kitchen timing report.
      module ChangeItemStatus
        RECALL_WINDOW = 30.minutes
        MOVES = {
          'start' => [%w[new], 'preparing'],
          'ready' => [%w[new preparing], 'ready'],
          'serve' => [%w[ready], 'served'],
          'recall' => [%w[ready served], 'preparing']
        }.freeze
        ACTIONS = MOVES.keys.freeze
        MAX_ALL_DAY = 99

        module_function

        # `actor` is the kitchen screen (Device) or the staff member.
        def call(item:, action:, actor:)
          move = MOVES[action.to_s]
          raise Conflict.new('That kitchen action is unknown.', reason: 'kitchen_action_invalid') if move.nil?

          changed = KitchenTicketItem.transaction do
            item.lock!
            apply!(item, action.to_s, move, actor, Workspace.database_now).tap do |moved|
              if moved
                PlatformOrders::MarkReady.after_kitchen(item.kitchen_ticket.workspace_id)
                print_ready_after_commit([item], actor) if action.to_s == 'ready'
              end
            end
          end
          publish(item.kitchen_ticket) if changed
          item
        end

        # Every new or preparing item of the ticket becomes ready at once.
        def bump(ticket:, actor:)
          changed = KitchenTicketItem.transaction do
            items = KitchenTicketItem.where(kitchen_ticket_id: ticket.id).order(:id).lock.to_a
            now = Workspace.database_now
            moved_items = items.select { |item| KitchenTicketItem::OPEN.include?(item.status) }
            moved_items.each { |item| apply!(item, 'ready', MOVES['ready'], actor, now) }
            moved = moved_items.any?
            # A delivery platform's order is ready for its driver.
            if moved
              PlatformOrders::MarkReady.after_kitchen(ticket.workspace_id)
              print_ready_after_commit(moved_items, actor)
            end
            moved
          end
          publish(ticket) if changed
          ticket.items.reset
          ticket
        end

        # One dish on the all-day view (Board.all_day_key): the oldest open
        # items of it at these stations become ready until `quantity` units
        # are covered. An item counts whole. Answers the tickets that moved.
        def bump_all_day(stations:, key:, actor:, quantity: 1)
          count = quantity.to_i
          raise Conflict.new('Bump between 1 and 99 at once.', reason: 'kitchen_all_day_invalid') unless count.between?(1, MAX_ALL_DAY)

          tickets = KitchenTicketItem.transaction do
            candidates = KitchenTicketItem.joins(:kitchen_ticket).
                         where(spree_pos_kitchen_tickets: { kitchen_station_id: stations.map(&:id), kind: 'fire' }).
                         where(status: KitchenTicketItem::OPEN).
                         order('spree_pos_kitchen_tickets.sent_at', :id).lock('FOR UPDATE OF spree_pos_kitchen_ticket_items').to_a
            matching = candidates.select { |item| Board.all_day_key(item) == key.to_s }
            raise Conflict.new('Nothing of that dish is waiting.', reason: 'kitchen_all_day_empty') if matching.empty?

            now = Workspace.database_now
            covered = BigDecimal('0')
            moved = matching.take_while do |item|
              next false if covered >= count

              covered += item.quantity
              true
            end
            moved.each { |item| apply!(item, 'ready', MOVES['ready'], actor, now) }
            tickets = KitchenTicket.where(id: moved.map(&:kitchen_ticket_id).uniq).includes(:kitchen_station, :workspace, :branch, :items).to_a
            tickets.map(&:workspace_id).uniq.each { |workspace_id| PlatformOrders::MarkReady.after_kitchen(workspace_id) }
            print_ready_after_commit(moved, actor) if moved.any?
            tickets
          end
          tickets.each { |ticket| publish(ticket) }
          tickets
        end

        # "Handed over": every ready item of the order becomes served, on
        # every ticket, and the call number leaves the board. Items still
        # being made stay as they are; an order with nothing ready changes
        # nothing, so a second tap is safe.
        def serve_order(workspace:, actor:)
          changed = KitchenTicketItem.transaction do
            items = KitchenTicketItem.joins(:kitchen_ticket).where(spree_pos_kitchen_tickets: { workspace_id: workspace.id }).
                    where(status: 'ready').order(:id).lock.to_a
            now = Workspace.database_now
            items.each { |item| apply!(item, 'serve', MOVES['serve'], actor, now) }
            KitchenTicket.where(id: items.map(&:kitchen_ticket_id).uniq).includes(:kitchen_station, :workspace, :branch).to_a
          end
          changed.each { |ticket| publish(ticket) }
          changed
        end

        def apply!(item, action, move, actor, now)
          from, to = move
          return false if item.status == to && action != 'recall'
          unless from.include?(item.status)
            raise Conflict.new("A #{item.status} item cannot be moved to #{to}.", reason: 'kitchen_status_invalid',
                                                                                  details: { status: item.status })
          end
          finished_at = item.served_at || item.ready_at
          if action == 'recall' && (finished_at.nil? || finished_at < now - RECALL_WINDOW)
            raise Conflict.new('Items can be recalled for 30 minutes after they are ready.', reason: 'kitchen_recall_expired')
          end

          item.update!(**times(item, action, now), status: to, changed_by: actor)
          audit_recall!(item, actor) if action == 'recall'
          true
        end

        def times(item, action, now)
          case action
          when 'start' then { started_at: now }
          when 'ready' then { started_at: item.started_at || now, ready_at: now }.merge(timing(item, now))
          when 'serve' then { served_at: now }
          when 'recall'
            { ready_at: nil, served_at: nil, prep_seconds: nil, late: false, recalled_at: now, recall_count: item.recall_count + 1 }
          end
        end

        # From the send to ready, against the station's red threshold.
        def timing(item, now)
          ticket = item.kitchen_ticket
          seconds = [(now - ticket.sent_at).round, 0].max
          { prep_seconds: seconds, late: seconds > ticket.kitchen_station.late_after_minutes * 60 }
        end

        # A person who calls a dish back is named in the audit log; a kitchen
        # screen is named on the item itself (changed_by, recall_count).
        def audit_recall!(item, actor)
          return unless actor.is_a?(Spree.admin_user_class)

          ticket = item.kitchen_ticket
          AuditEntry.record!(store: ticket.store, actor: actor, action: 'kitchen.recall', subject: item,
                             metadata: { kitchen_ticket_id: ticket.prefixed_id, workspace_id: ticket.workspace.prefixed_id,
                                         recall_count: item.recall_count })
        end

        def publish(ticket)
          Realtime.publish(ticket.branch, 'kitchen_ticket.updated',
                           id: ticket.prefixed_id, refs: { workspace_id: ticket.workspace.prefixed_id,
                                                           kitchen_station_id: ticket.kitchen_station.prefixed_id })
        end

        def print_ready_after_commit(items, actor)
          ids = items.map(&:id)
          ActiveRecord.after_all_transactions_commit { print_ready!(ids, actor) }
        end

        def print_ready!(item_ids, actor)
          loaded = KitchenTicketItem.where(id: item_ids, status: 'ready').
                   includes(kitchen_ticket: [{ kitchen_station: { expo_station: { printer: :print_station_device } } },
                                             :branch, :store, { workspace: { resource: :area } }]).
                   order(:id).to_a
          return if loaded.empty?

          branch = loaded.first.kitchen_ticket.branch
          return unless SalesSettings.for(branch)['auto_print_ready_ticket']

          branch_printers = Printer.where(branch_id: branch.id, status: 'active').includes(:print_station_device).to_a
          staff = actor.is_a?(Spree.admin_user_class) ? actor : nil
          loaded.group_by { |item| [ready_printer_for(item.kitchen_ticket.kitchen_station, branch_printers), item.kitchen_ticket.workspace] }.
            each do |(printer, workspace), group|
              if printer.nil?
                Rails.logger.info("[pos] ready ticket for workspace #{workspace.prefixed_id} not queued: no active ready_ticket printer")
                next
              end

              ready_at = group.filter_map(&:ready_at).max || Workspace.database_now
              stamp = group.map { |row| "#{row.id}@#{row.ready_at&.utc&.iso8601(6)}" }.join(',')
              key = "ready_ticket:#{Digest::SHA256.hexdigest("#{printer.id}:#{stamp}")}"
              PrintJobs::Enqueue.call(
                store: workspace.store, printer: printer, kind: 'ready_ticket',
                document: TicketDocument.ready(workspace: workspace, items: group, ready_at: ready_at),
                key: key, actor: staff, source: group.first.kitchen_ticket
              )
            rescue StandardError => e
              Rails.logger.error("[pos] ready ticket for workspace #{workspace.prefixed_id} not queued: #{e.class}: #{e.message}")
            end
        rescue StandardError => e
          Rails.logger.error("[pos] ready tickets not queued: #{e.class}: #{e.message}")
        end

        def ready_printer_for(station, branch_printers)
          expo = station.expo_station
          expo_printer = expo&.active ? expo.printer : nil
          return expo_printer if expo_printer&.station? && expo_printer.accepting_jobs? && expo_printer.prints?('ready_ticket')

          branch_printers.select { |printer| printer.station? && printer.accepting_jobs? && printer.prints?('ready_ticket') }.
            min_by { |printer| [printer.register_id.nil? ? 0 : 1, printer.id] }
        end
      end
    end
  end
end
