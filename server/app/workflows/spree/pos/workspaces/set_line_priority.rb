# frozen_string_literal: true

module Spree
  module Pos
    module Workspaces
      # Marks a menu line urgent, or takes the mark off, on any open order:
      # a table order, a tab or a counter sale. It changes no money and tells
      # the kitchen nothing new, so it needs no lease and no order revision;
      # the line's own `row_version` is checked instead, so two people
      # changing one line never overwrite each other. A line already sent
      # to the kitchen passes the mark on to the items still being made.
      module SetLinePriority
        module_function

        def call(workspace:, staff:, key:, sale_line_id:, row_version:, priority:)
          flag = Kitchen::Priority.flag!(priority)
          payload = { 'command' => 'set_line_priority', 'sale_line_id' => sale_line_id.to_s, 'row_version' => row_version.to_s,
                      'priority' => flag }
          AppendItems.run(workspace: workspace, staff: staff, key: key, payload: payload) do
            unless Workspace::OPEN_STATUSES.include?(workspace.operational_status)
              raise Conflict.new('This order is no longer open.', revision: workspace.revision, reason: 'workspace_closed')
            end

            sale_line = EditUnsentLine.current_line!(workspace, sale_line_id, row_version)
            unless sale_line.kind == SaleLineKinds::Menu::KIND
              raise Conflict.new('Only a menu line can be a priority.', revision: workspace.revision, reason: 'line_not_menu')
            end

            if sale_line.priority != flag
              sale_line.update!(priority: flag)
              Kitchen::Priority.follow_line!(sale_line, flag, staff)
              workspace.update!(revision: workspace.revision + 1)
              AuditEntry.record!(store: workspace.store, actor: staff, action: 'workspace.item.priority', subject: workspace,
                                 metadata: { sale_line_id: sale_line.prefixed_id, priority: flag, row_version: sale_line.row_version })
            end
            workspace.to_pos
          end
        end
      end
    end
  end
end
