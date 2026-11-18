# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Label data for printing product stickers from a branch's goods list,
          # and the print of them on a branch's label printer.
          class ProductLabelsController < BaseController
            scoped_resource :pos_topology
            pos_permissions data: %w[read_pos_topology write_pos_topology read_products write_products],
                            print: %w[read_pos_topology write_pos_topology read_products write_products]

            Invalid = Spree::Pos::ReceiptTemplateSchema::Invalid
            # A job carries at most Document::MAX_LABELS_PER_JOB labels; a longer
            # list becomes several jobs, up to this many labels in all.
            MAX_PRINT_LABELS = Spree::Pos::ProductLabels::Document::MAX_LABELS_PER_JOB * 10

            # A POST that only reads: the item list is too long for a query string.
            def data
              return if channel_rejected?

              branch = branch!(params[:branch_id])
              render json: Spree::Pos::ProductLabels::Data.call(store: current_store, branch: branch, items: params[:items])
            end

            # Queues the labels on a branch's label printer, in jobs of at most
            # 2000 labels. Only roll stocks go this way; a sheet prints from the
            # browser.
            def print
              return if channel_rejected?

              key = idempotency_key
              return if key.nil?

              branch = branch!(params[:branch_id])
              Spree::Pos::PrintJobs::Guard.read!(current_store, current_user, branch)
              template = label_template!
              printer = Spree::Pos::PrintJobs::Guard.printer!(current_store, params[:printer_id], branch: branch)
              items = params.to_unsafe_h['items']
              payload = { 'command' => 'product_label.print', 'template_id' => template.prefixed_id, 'printer_id' => printer.prefixed_id,
                          'items' => items }
              result = Spree::Pos::CommandExecutor.call(store: current_store, actor: current_user, key: key, payload: payload, authorize: -> {}) do
                { 'print_jobs' => enqueue(branch, template, printer, items, key).map(&:to_pos) }
              end
              render json: { data: result }, status: :created
            end

            private

            def label_template!
              scope = Spree::Pos::ReceiptTemplate.for_store(current_store).active.where(document_type: 'product_label')
              template = Spree::Pos::ReceiptTemplate.locate(scope, params[:template_id])
              raise Invalid.at('/template_id', 'not_found', 'Label template not found.') if template.nil?
              return template unless template.paper.start_with?('sheet_')

              raise Invalid.at('/template_id', 'sheet_needs_browser', 'Sheet label stocks print from the browser.')
            end

            def enqueue(branch, template, printer, items, key)
              Spree::Pos::PrintJobs::Enqueue.ensure_accepts!(printer, 'product_label')
              data = Spree::Pos::ProductLabels::Data.call(store: current_store, branch: branch, items: items, max_labels: MAX_PRINT_LABELS)
              preset = Spree::Pos::ReceiptTemplate::LABEL_PRESETS.find { |candidate| candidate['code'] == template.paper }
              documents = Spree::Pos::ProductLabels::Document.jobs(config: template.current_config, preset: preset, items: data[:data],
                                                                   store: data[:store], now: Spree::Pos::Workspace.database_now,
                                                                   time_zone: branch.timezone)
              documents.each_with_index.map do |document, index|
                job_key = "#{Spree::Pos::PrintJobs::Create.job_key(current_user, key)}:#{index}"
                Spree::Pos::PrintJobs::Enqueue.call(store: current_store, printer: printer, kind: 'product_label', document: document, key: job_key,
                                                    actor: current_user, source: printer, receipt_template: template,
                                                    template_version: template.current_version)
              end
            end
          end
        end
      end
    end
  end
end
