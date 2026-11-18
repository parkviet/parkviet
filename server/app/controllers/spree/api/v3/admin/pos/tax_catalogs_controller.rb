# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The Vietnam tax catalog in force: tax offices and business lines,
          # each list with its basis. Static per release, so it is cached.
          class TaxCatalogsController < BaseController
            scoped_resource :pos_topology
            pos_permissions show: %w[read_pos_topology write_pos_topology]

            def show
              return if channel_rejected?

              expires_in 1.day, public: false
              fresh_when(etag: Spree::Pos::VnTaxCatalog.etag, public: false)
              return if performed?

              render json: { data: Spree::Pos::VnTaxCatalog.as_payload }
            end
          end
        end
      end
    end
  end
end
