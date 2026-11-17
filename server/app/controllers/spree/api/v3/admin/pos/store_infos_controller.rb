# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          class StoreInfosController < BaseController
            scoped_resource :pos_topology
            pos_permissions show: %w[read_pos_topology write_pos_topology]
            rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid

            def show
              return if channel_rejected?

              render json: { data: Spree::Pos::StoreInfos::Save.present(current_store, reveal: policy.permission?('write_pos_topology')) }
            end

            def update
              return if channel_rejected?

              data = Spree::Pos::StoreInfos::Save.call(store: current_store, actor: current_user, attributes: info_params,
                                                       profile_key: params[:profile_key], profile_keys: profile_keys,
                                                       wholesale: params.key?(:wholesale) ? params[:wholesale] : nil,
                                                       interests: params.key?(:interests) ? Array(params[:interests]) : nil,
                                                       reason: params[:reason].presence || 'store_info')
              render json: { data: data }
            end

            def logo
              return if channel_rejected?

              file = logo_file
              data = Spree::Pos::StoreInfos::Save.attach_logo!(store: current_store, actor: current_user, **file)
              render json: { data: data }
            end

            def destroy_logo
              return if channel_rejected?

              data = Spree::Pos::StoreInfos::Save.remove_logo!(store: current_store, actor: current_user)
              render json: { data: data }
            end

            private

            def profile_keys
              params.key?(:profile_keys) ? Array(params[:profile_keys]) : nil
            end

            def render_record_invalid(error)
              render_validation_error(error.record.errors)
            end

            def info_params
              params.permit(Spree::Pos::StoreInfo::CONTACT)
            end

            def logo_file
              upload = params[:logo]
              if upload.respond_to?(:read)
                return { io: upload, filename: upload.original_filename, content_type: upload.content_type }
              end

              raw = params[:data].to_s
              raise Spree::Pos::Conflict.new('Choose an image.', reason: 'parameter_invalid') if raw.blank?

              payload = raw.sub(/\Adata:.*?;base64,/, '')
              { io: StringIO.new(Base64.decode64(payload)), filename: params[:filename].presence || 'logo',
                content_type: params[:content_type].presence || 'image/png' }
            end
          end
        end
      end
    end
  end
end
