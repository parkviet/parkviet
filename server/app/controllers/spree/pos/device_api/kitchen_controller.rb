# frozen_string_literal: true

module Spree
  module Pos
    module DeviceApi
      # The kitchen screen's side: a device paired as `kds` or `expo` works
      # the kitchen of its own branch as the machine, without a PIN. Marking
      # an item sold out names a person, so it goes through the staff API with
      # a PIN session (PUT menu_availabilities).
      class KitchenController < BaseController
        before_action { require_mode!(*Kitchen::Guard::DEVICE_MODES) }
        before_action :require_live_branch!

        rescue_from Conflict do |error|
          details = { reason: error.reason }.compact
          details = error.details.merge(details) if error.details.is_a?(Hash)
          render json: { error: { code: 'conflict', message: error.message, details: details } }, status: :conflict
        end

        def stations
          rows = KitchenStation.where(branch_id: @device.branch_id).active.ordered.includes(:branch, :printer)
          render json: { data: rows.map(&:to_pos) }
        end

        # The station this screen shows; blank for every station (the pass).
        def select_station
          station = params[:station_id].present? ? Kitchen::Guard.station!(@device.branch, params[:station_id]) : nil
          @device.update!(kitchen_station_id: station&.id)
          render json: { data: @device.to_pos }
        end

        # One station (the device's own unless named), several
        # (station_ids, a screen that watches more than one), or every
        # station (an empty station_id).
        def board
          stations = Kitchen::Guard.stations!(@device.branch, params[:station_ids])
          station = stations.empty? ? station_param : nil
          render json: { data: Kitchen::Board.call(branch: @device.branch, station: station, stations: stations,
                                                   service_mode: Kitchen::Guard.service_mode!(params[:service_mode])) }
        end

        # The oldest open items of one dish on the "by dish" tab become ready.
        def bump_all_day
          stations = Kitchen::Guard.stations!(@device.branch, params[:station_ids])
          stations = Array(station_param) if stations.empty?
          stations = KitchenStation.where(branch_id: @device.branch_id).active.to_a if stations.empty?
          tickets = Kitchen::ChangeItemStatus.bump_all_day(stations: stations, key: params[:key], quantity: params[:quantity] || 1,
                                                           actor: @device)
          render json: { data: tickets.map(&:to_pos) }
        end

        def start = change('start')
        def ready = change('ready')
        def recall = change('recall')

        # The pass hands a ready dish out; the order is announced too.
        def serve
          item = Kitchen::Guard.item!(@device.branch, params[:id])
          Kitchen::MarkServed.call(item: item, actor: @device)
          render json: { data: item.kitchen_ticket.reload.to_pos }
        end

        # A pass screen fires a held course of a table order.
        def fire_course
          workspace = Kitchen::Guard.workspace!(@device.branch, params[:workspace_id])
          key = request.headers['Idempotency-Key'].presence || params[:idempotency_key].to_s.presence
          if key.blank? || key.length > 200
            return render json: { error: { code: 'parameter_invalid', message: 'Idempotency-Key is required.' } }, status: :unprocessable_content
          end

          result = Kitchen::FireCourse.call(workspace: workspace, actor: @device, course: params[:course], key: key)
          render json: { data: result['workspace'], meta: { tickets: result['tickets'], ticket_count: result['ticket_count'] } }
        end

        def bump
          ticket = Kitchen::Guard.ticket!(@device.branch, params[:id])
          Kitchen::ChangeItemStatus.bump(ticket: ticket, actor: @device)
          render json: { data: ticket.reload.to_pos }
        end

        # "Handed over" from the finished tickets: every ready item of the
        # order is served and its call number leaves the board.
        def serve_order
          workspace = Kitchen::Guard.workspace!(@device.branch, params[:workspace_id])
          tickets = Kitchen::ChangeItemStatus.serve_order(workspace: workspace, actor: @device)
          render json: { data: { workspace_id: workspace.prefixed_id, tickets: tickets.map { |ticket| ticket.reload.to_pos } } }
        end

        # The prepared products the branch sells that this station makes, and
        # whether each is sold out today, for the screen's "sold out" list.
        def products
          station = station_param
          branch = @device.branch
          router = Kitchen::Router.new(branch)
          routed = StationRoute.where(branch_id: branch.id, kitchen_station_id: station&.id).pluck(:product_id, :kitchen_category)
          sold_out = MenuAvailability.sold_out_ids(branch, BusinessDay.for(branch, Workspace.business_now)).to_set
          rows = Menu::Sellable.prepared(branch).includes(:pos_setting).order(:name, :id).to_a.
                 map { |product| [product, product.pos_setting&.kitchen_category] }
          rows.select! { |product, category| makes?(router, station, routed, product.id, category) } if station
          render json: {
            data: rows.map do |product, category|
              { product_id: product.prefixed_id, name: product.name, kitchen_category: category, sold_out: sold_out.include?(product.id) }
            end
          }
        end

        private

        def require_live_branch!
          return unless @device.branch.disabled?

          render json: { error: { code: 'device_mode_forbidden', message: 'This branch is disabled.' } }, status: :forbidden
        end

        def station_param
          id = params.key?(:station_id) ? params[:station_id] : @device.kitchen_station&.prefixed_id
          id.present? ? Kitchen::Guard.station!(@device.branch, id) : nil
        end

        def change(action)
          item = Kitchen::Guard.item!(@device.branch, params[:id])
          Kitchen::ChangeItemStatus.call(item: item, action: action, actor: @device)
          render json: { data: item.kitchen_ticket.reload.to_pos }
        end

        # Sent here for some service mode: by its own route, or by default.
        def makes?(router, station, routed, product_id, kitchen_category)
          return true if routed.any? { |routed_id, category| routed_id == product_id || (category && category == kitchen_category) }

          router.station_for_product(product_id, kitchen_category, nil)&.id == station.id
        end
      end
    end
  end
end
