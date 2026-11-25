# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Customer groups and supplier groups for POS Partners.
          class PartnerGroupsController < BaseController
            scoped_resource :pos_orders
            pos_permissions index: %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology],
                            create: %w[write_pos_orders write_pos_topology],
                            update: %w[write_pos_orders write_pos_topology],
                            destroy: %w[write_pos_orders write_pos_topology]

            def index
              kind = params[:kind].presence || 'customer'
              groups = Spree::Pos::PartnerGroup.for_store(current_store).of_kind(kind).order(:name).to_a

              counts = if kind == 'supplier'
                         Spree::Pos::Supplier.for_store(current_store).group(:partner_group_id).count
                       else
                         Spree::Pos::CustomerProfile.for_store(current_store).group(:partner_group_id).count
                       end

              render json: {
                data: groups.map { |g| g.to_pos(members_count: counts[g.id] || 0) }
              }
            end

            def create
              group = Spree::Pos::PartnerGroup.create!(
                store: current_store,
                kind: params[:kind].to_s,
                name: params[:name],
                note: params[:note].presence
              )
              render json: { data: group.to_pos(members_count: 0) }, status: :created
            end

            def update
              group = find_group!
              group.update!(name: params[:name] || group.name, note: params.key?(:note) ? params[:note].presence : group.note)
              render json: { data: group.to_pos }
            end

            def destroy
              group = find_group!
              group.destroy!
              head :no_content
            end

            private

            def find_group!
              group = Spree::Pos::PartnerGroup.for_store(current_store).find_by_prefix_id(params[:id].to_s)
              raise ActiveRecord::RecordNotFound if group.nil?

              group
            end
          end
        end
      end
    end
  end
end
