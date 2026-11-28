# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Public self-registration for multi-store POS deployments.
          # Creates an AdminUser and a fresh store they administer so they can
          # sign in and start onboarding right away without requiring SMTP.
          class RegistrationsController < ActionController::API
            REGISTER_ATTEMPTS = 10
            REGISTER_WINDOW = 15.minutes
            LIMIT_STORE = Rails.cache.is_a?(ActiveSupport::Cache::NullStore) ? ActiveSupport::Cache::MemoryStore.new : Rails.cache

            before_action :no_store
            rate_limit to: REGISTER_ATTEMPTS, within: REGISTER_WINDOW, only: :create, store: LIMIT_STORE,
                       with: -> { render_error('registration_rate_limited', 'Too many registration attempts. Please try again later.', :too_many_requests) }

            # GET /api/v3/admin/pos/registration
            def show
              render json: { data: { enabled: Spree::Pos::PublicRegistration.enabled? } }
            end

            # POST /api/v3/admin/pos/registration
            def create
              unless Spree::Pos::PublicRegistration.enabled?
                return render_error('registration_disabled', 'Public registration is disabled.', :forbidden)
              end

              errors = validate_params
              return render_validation_errors(errors) if errors.any?

              country = resolve_country
              if country.nil?
                return render_validation_errors(country_code: ['Unknown country'])
              end

              user = nil
              store = nil
              first_name, last_name = split_name

              ApplicationRecord.transaction do
                user = Spree.admin_user_class.create!(
                  email: normalized_email,
                  first_name: first_name,
                  last_name: last_name,
                  password: password_param,
                  password_confirmation: password_param
                )

                store = Spree::Stores::CreateAdditional.call(
                  owner: user,
                  country: country,
                  attributes: store_attributes,
                  locale: params[:locale].presence,
                  currency: params[:currency].presence
                )
              end

              render json: {
                data: {
                  user: {
                    id: user.prefixed_id,
                    email: user.email,
                    full_name: user.full_name
                  },
                  store: {
                    id: store.prefixed_id,
                    name: store.name,
                    code: store.code
                  }
                }
              }, status: :created
            rescue ActiveRecord::RecordNotUnique
              render_validation_errors(email: ['An account with this email already exists.'], code: 'email_taken')
            rescue ActiveRecord::RecordInvalid => e
              code = e.record.errors.of_kind?(:email, :taken) ? 'email_taken' : 'validation_error'
              render_validation_errors(e.record.errors.to_hash(true), code: code)
            end

            private

            def no_store
              response.headers['Cache-Control'] = 'no-store'
              response.headers['Pragma'] = 'no-cache'
              response.headers['Referrer-Policy'] = 'no-referrer'
              response.headers['X-Content-Type-Options'] = 'nosniff'
            end

            def normalized_email
              params[:email].to_s.strip.downcase
            end

            def password_param
              params[:password].to_s
            end

            def store_name_param
              params[:store_name].to_s.strip
            end

            def split_name
              if params[:first_name].present? || params[:last_name].present?
                return [params[:first_name].to_s.strip.presence, params[:last_name].to_s.strip.presence]
              end

              full = params[:full_name].to_s.strip
              return [nil, nil] if full.empty?

              parts = full.split(/\s+/)
              return [parts.first, nil] if parts.length == 1

              [parts[0..-2].join(' '), parts.last]
            end

            def validate_params
              errors = {}
              errors[:store_name] = ["Store name can't be blank"] if store_name_param.empty?
              errors[:store_name] = ['Store name is too long (maximum 120 characters)'] if store_name_param.length > 120

              if normalized_email.empty?
                errors[:email] = ["Email can't be blank"]
              elsif !URI::MailTo::EMAIL_REGEXP.match?(normalized_email)
                errors[:email] = ['Email is invalid']
              end

              if password_param.length < 6
                errors[:password] = ['Password must be at least 6 characters']
              end

              errors
            end

            def resolve_country
              code = params[:country_code].to_s.strip.upcase.presence || 'VN'
              Spree::Country.by_iso(code) || (params[:country_code].blank? ? Spree::Store.default&.default_country : nil)
            end

            def store_attributes
              default_store = Spree::Store.default
              {
                name: store_name_param,
                url: default_store&.url.presence || 'localhost',
                mail_from_address: ENV['SMTP_FROM_ADDRESS'].presence || default_store&.mail_from_address.presence || 'no-reply@parkviet.local',
                customer_support_email: default_store&.customer_support_email.presence || normalized_email
              }
            end

            def render_error(code, message, status, details: nil)
              payload = { code: code, message: message }
              payload[:details] = details if details.present?
              render json: { error: payload }, status: status
            end

            def render_validation_errors(details, code: 'validation_error')
              first_message = details.values.flatten.first || 'Validation failed.'
              render_error(code, first_message, :unprocessable_content, details: details)
            end
          end
        end
      end
    end
  end
end
