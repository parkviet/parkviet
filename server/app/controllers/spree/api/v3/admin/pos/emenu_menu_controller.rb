# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # The electronic menu of one branch: the whole tree in one read and
          # one write, a copy of the counter menu, and a category image.
          class EmenuMenuController < BaseController
            scoped_resource :pos_topology
            READERS = %w[read_pos_orders write_pos_orders read_pos_topology write_pos_topology].freeze
            WRITERS = %w[write_pos_orders write_pos_topology].freeze
            pos_permissions show: READERS, update: WRITERS, import: WRITERS, image: WRITERS

            def show
              branch = branch!(params[:branch_id])
              Spree::Pos::Resources::Guard.read!(current_store, current_user, branch)
              render json: { data: Spree::Pos::EmenuMenu.read(branch) }
            end

            def update
              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              categories = params.to_unsafe_h['categories']
              data = Spree::Pos::EmenuMenu.replace!(store: current_store, actor: current_user, key: key, branch: branch, categories: categories)
              render json: { data: data }
            rescue Spree::Pos::EmenuSettings::Invalid => error
              render_error(code: 'validation_error', message: error.message, status: :unprocessable_content, details: { field: error.field })
            end

            def import
              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              data = Spree::Pos::EmenuMenu.import!(store: current_store, actor: current_user, key: key, branch: branch)
              render json: { data: data }
            end

            def image
              branch = branch!(params[:branch_id])
              file = params[:image]
              raise ActiveRecord::RecordNotFound unless file.respond_to?(:read)

              data = Spree::Pos::EmenuMenu.attach_image!(store: current_store, actor: current_user, branch: branch,
                                                         category_id: params[:category_id], io: file, filename: file.original_filename,
                                                         content_type: file.content_type)
              render json: { data: data }
            rescue Spree::Pos::EmenuSettings::Invalid => error
              render_error(code: 'validation_error', message: error.message, status: :unprocessable_content, details: { field: error.field })
            end
          end
        end
      end
    end
  end
end
