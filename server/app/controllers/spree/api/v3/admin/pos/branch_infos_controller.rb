# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # One branch's overrides of the store details. Store writers and the
          # branch's topology manager may change them.
          class BranchInfosController < BaseController
            scoped_resource :pos_topology
            MANAGERS = %w[read_pos_orders read_pos_topology write_pos_topology].freeze
            pos_permissions show: MANAGERS, update: MANAGERS, logo: MANAGERS, destroy_logo: MANAGERS
            rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid

            def show
              return if channel_rejected?

              branch = branch!(params[:branch_id])
              raise CanCan::AccessDenied unless readable?(branch)

              render json: { data: Spree::Pos::BranchInfos::Save.present(branch, reveal: policy.permission?('write_pos_topology')) }
            end

            def update
              return if channel_rejected?

              data = Spree::Pos::BranchInfos::Save.call(store: current_store, actor: current_user, branch: branch!(params[:branch_id]),
                                                        attributes: params.permit(Spree::Pos::BranchInfos::Save::FIELDS + ['business_day_cutoff']))
              render json: { data: data }
            end

            def logo
              return if channel_rejected?

              file = uploaded
              data = Spree::Pos::BranchInfos::Save.attach_logo!(store: current_store, actor: current_user, branch: branch!(params[:branch_id]), **file)
              render json: { data: data }
            end

            def destroy_logo
              return if channel_rejected?

              data = Spree::Pos::BranchInfos::Save.remove_logo!(store: current_store, actor: current_user, branch: branch!(params[:branch_id]))
              render json: { data: data }
            end

            private

            def render_record_invalid(error)
              render_validation_error(error.record.errors)
            end

            def readable?(branch)
              policy.permission?('read_pos_topology') || policy.permission?('write_pos_topology') ||
                Spree::Pos::BranchModules::Set.manage?(policy, branch)
            end

            def uploaded
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
