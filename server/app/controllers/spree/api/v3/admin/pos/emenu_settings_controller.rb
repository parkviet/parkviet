# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # A branch's electronic menu options. Unknown keys are 422.
          class EmenuSettingsController < BaseController
            scoped_resource :pos_topology
            READERS = %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology].freeze
            WRITERS = %w[write_pos_orders write_pos_topology].freeze
            pos_permissions show: READERS, update: WRITERS

            def show
              branch = branch!(params[:branch_id])
              Spree::Pos::Resources::Guard.read!(current_store, current_user, branch)
              render json: { data: Spree::Pos::EmenuSettings::Update.present(branch) }
            end

            def update
              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              data = Spree::Pos::EmenuSettings::Update.call(store: current_store, actor: current_user, key: key, branch: branch,
                                                            attributes: settings_attributes)
              render json: { data: data }
            rescue Spree::Pos::EmenuSettings::Invalid => error
              render_error(code: 'validation_error', message: error.message, status: :unprocessable_content, details: { field: error.field })
            end

            private

            def settings_attributes
              raw = params[:emenu_settings]
              source = raw.respond_to?(:to_unsafe_h) ? raw.to_unsafe_h : params.to_unsafe_h
              source.except('branch_id', 'idempotency_key', 'controller', 'action', 'format', 'emenu_settings')
            end
          end
        end
      end
    end
  end
end
