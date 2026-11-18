# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The store's tax options for every tax picker: one per catalog
          # option of the method in force, with its category id and the
          # defaults it holds.
          class TaxOptionsController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology]

            def index
              return if channel_rejected?

              render json: { data: Spree::Pos::TaxOptions.for(current_store) }
            end
          end
        end
      end
    end
  end
end
