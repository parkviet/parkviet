# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          class TaxDeclarationsController < BaseController
            scoped_resource :pos_topology
            pos_permissions index: %w[read_pos_topology write_pos_topology],
                            show: %w[read_pos_topology write_pos_topology]
            before_action :find_declaration, only: %i[show update destroy recalculate]

            def index
              scope = Spree::Pos::TaxDeclaration.for_store(current_store).order(period_year: :desc, period_number: :desc, id: :desc)
              case params[:group].to_s
              when 'cnkd'
                scope = scope.where(declaration_type: '01_cnkd')
              when 'vat'
                scope = scope.where(declaration_type: %w[01_gtgt 04_gtgt])
              when 'pit'
                scope = scope.where(declaration_type: '05_kk_tncn')
              end
              scope = scope.where(declaration_type: params[:declaration_type]) if params[:declaration_type].present?
              scope = scope.where(status: params[:status]) if params[:status].present?
              if params[:q].present?
                q = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].to_s.strip)}%"
                scope = scope.where('code ILIKE :q OR note ILIKE :q', q: q)
              end
              scope = scope.where('from_date >= ?', Date.parse(params[:from])) if params[:from].present?
              scope = scope.where('to_date <= ?', Date.parse(params[:to])) if params[:to].present?

              records = scope.limit(200).to_a
              render json: {
                declarations: records.map(&:to_pos),
                taxpayer: Spree::Pos::AccountingBooks.taxpayer_snapshot(current_store),
                currency: current_store.default_currency || 'VND'
              }
            rescue ArgumentError
              render_pos_error(status: :unprocessable_entity, code: 'invalid_date', message: 'Invalid date filter')
            end

            def show
              render json: { declaration: @declaration.to_pos }
            end

            def create
              declaration_type = params[:declaration_type].to_s
              period_type = params[:period_type].presence || 'quarter'
              period_year = (params[:period_year].presence || Date.current.year).to_i
              period_number = (params[:period_number].presence || (((Date.current.month - 1) / 3) + 1)).to_i
              from_date, to_date = Spree::Pos::TaxDeclaration.period_bounds(period_type, period_year, period_number)
              options = extract_options

              calculator = Spree::Pos::AccountingBooks.new(
                store: current_store,
                from_date: from_date,
                to_date: to_date,
                options: options
              )
              summary = calculator.compute_declaration(declaration_type)
              snapshot = Spree::Pos::AccountingBooks.taxpayer_snapshot(current_store)

              declaration = Spree::Pos::TaxDeclaration.new(
                store: current_store,
                code: Spree::Pos::TaxDeclaration.next_code(current_store, declaration_type, period_type, period_year, period_number),
                declaration_type: declaration_type,
                period_type: period_type,
                period_year: period_year,
                period_number: period_number,
                from_date: from_date,
                to_date: to_date,
                status: 'draft',
                options: options,
                summary: summary,
                taxpayer_snapshot: snapshot,
                note: params[:note].presence,
                created_by: current_user,
                updated_by: current_user
              )

              if declaration.save
                render json: { declaration: declaration.to_pos }, status: :created
              else
                render_pos_error(status: :unprocessable_entity, code: 'validation_error',
                                 message: declaration.errors.full_messages.to_sentence)
              end
            rescue ArgumentError => e
              render_pos_error(status: :unprocessable_entity, code: 'invalid_params', message: e.message)
            end

            def recalculate
              unless %w[draft rejected].include?(@declaration.status)
                return render_pos_error(status: :unprocessable_entity, code: 'locked',
                                        message: 'Cannot recalculate a submitted or accepted declaration')
              end

              calculator = Spree::Pos::AccountingBooks.new(
                store: current_store,
                from_date: @declaration.from_date,
                to_date: @declaration.to_date,
                options: @declaration.options
              )
              @declaration.summary = calculator.compute_declaration(@declaration.declaration_type)
              @declaration.taxpayer_snapshot = Spree::Pos::AccountingBooks.taxpayer_snapshot(current_store)
              @declaration.updated_by = current_user
              @declaration.save!
              render json: { declaration: @declaration.to_pos }
            end

            def update
              attrs = { updated_by: current_user }
              if params.key?(:note)
                attrs[:note] = params[:note].presence
              end
              if params[:status].present?
                new_status = params[:status].to_s
                attrs[:status] = new_status
                attrs[:submitted_at] = Time.current if new_status == 'submitted' && @declaration.submitted_at.nil?
                attrs[:accepted_at] = Time.current if new_status == 'accepted' && @declaration.accepted_at.nil?
              end

              if @declaration.update(attrs)
                render json: { declaration: @declaration.to_pos }
              else
                render_pos_error(status: :unprocessable_entity, code: 'validation_error',
                                 message: @declaration.errors.full_messages.to_sentence)
              end
            end

            def destroy
              unless @declaration.status == 'draft'
                return render_pos_error(status: :unprocessable_entity, code: 'cannot_delete',
                                        message: 'Only draft declarations can be deleted')
              end

              @declaration.destroy!
              head :no_content
            end

            private

            def find_declaration
              @declaration = Spree::Pos::TaxDeclaration.for_store(current_store).find_by_prefix_id(params[:id]) ||
                             Spree::Pos::TaxDeclaration.for_store(current_store).find_by(id: params[:id])
              return if @declaration

              render_pos_error(status: :not_found, code: 'not_found', message: 'Tax declaration not found')
            end

            def extract_options
              raw = params[:options].respond_to?(:to_unsafe_h) ? params[:options].to_unsafe_h : {}
              {
                'revenue_source' => raw['revenue_source'].presence || 'all_orders',
                'date_field' => raw['date_field'].presence || 'completed_at',
                'rate_source' => raw['rate_source'].presence || 'order_time',
                'include_cancelled' => ActiveModel::Type::Boolean.new.cast(raw['include_cancelled']) || false,
                'has_excise' => ActiveModel::Type::Boolean.new.cast(raw['has_excise']) || false,
                'has_resource_env' => ActiveModel::Type::Boolean.new.cast(raw['has_resource_env']) || false
              }
            end
          end
        end
      end
    end
  end
end
