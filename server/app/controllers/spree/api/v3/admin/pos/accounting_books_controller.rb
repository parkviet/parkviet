# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          class AccountingBooksController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology],
                            show: %w[read_pos_topology write_pos_topology]

            def index
              taxpayer = Spree::Pos::AccountingBooks.taxpayer_snapshot(current_store)
              render json: {
                books: Spree::Pos::AccountingBooks::BOOKS,
                taxpayer: taxpayer,
                currency: current_store.default_currency || 'VND'
              }
            end

            def show
              book_code = params[:id].to_s.downcase
              unless Spree::Pos::AccountingBooks::BOOKS.any? { |b| b[:code] == book_code }
                return render_pos_error(status: :not_found, code: 'not_found', message: 'Accounting book not found')
              end

              from_date, to_date = resolve_date_range
              service = Spree::Pos::AccountingBooks.new(
                store: current_store,
                from_date: from_date,
                to_date: to_date,
                branch_id: params[:branch_id].presence,
                options: {
                  revenue_source: params[:revenue_source],
                  date_field: params[:date_field],
                  rate_source: params[:rate_source],
                  include_cancelled: params[:include_cancelled]
                }
              )
              render json: service.compute_book(book_code)
            end

            private

            def resolve_date_range
              if params[:from].present? && params[:to].present?
                [Date.parse(params[:from]), Date.parse(params[:to])]
              elsif params[:period_type].present? && params[:period_year].present? && params[:period_number].present?
                Spree::Pos::TaxDeclaration.period_bounds(params[:period_type], params[:period_year], params[:period_number])
              else
                today = Date.current
                q = ((today.month - 1) / 3) + 1
                Spree::Pos::TaxDeclaration.period_bounds('quarter', today.year, q)
              end
            rescue ArgumentError
              [Date.current.beginning_of_month, Date.current.end_of_month]
            end
          end
        end
      end
    end
  end
end
