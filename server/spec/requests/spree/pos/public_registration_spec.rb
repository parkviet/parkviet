# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'

RSpec.describe 'Public POS registration', type: :request do
  let(:default_store) { Spree::Store.default }

  before do
    Spree::Api::V3::Admin::Pos::RegistrationsController::LIMIT_STORE.clear
  end

  around do |example|
    previous = ENV.fetch('PARKVIET_PUBLIC_REGISTRATION', nil)
    example.run
  ensure
    if previous.nil?
      ENV.delete('PARKVIET_PUBLIC_REGISTRATION')
    else
      ENV['PARKVIET_PUBLIC_REGISTRATION'] = previous
    end
  end

  describe 'GET /api/v3/admin/pos/registration' do
    it 'is disabled by default outside development' do
      ENV.delete('PARKVIET_PUBLIC_REGISTRATION')

      get '/api/v3/admin/pos/registration', as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('data', 'enabled')).to be(false)
    end

    it 'reports enabled when PARKVIET_PUBLIC_REGISTRATION is true' do
      ENV['PARKVIET_PUBLIC_REGISTRATION'] = 'true'

      get '/api/v3/admin/pos/registration', as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('data', 'enabled')).to be(true)
    end
  end

  describe 'POST /api/v3/admin/pos/registration' do
    it 'refuses registration when disabled' do
      ENV['PARKVIET_PUBLIC_REGISTRATION'] = 'false'

      expect do
        post '/api/v3/admin/pos/registration', params: {
          store_name: 'Cà phê Mới',
          full_name: 'Nguyễn Văn A',
          email: 'owner@example.test',
          password: 'password123'
        }, as: :json
      end.not_to change(Spree::Store, :count)

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body.dig('error', 'code')).to eq('registration_disabled')
    end

    context 'when enabled' do
      before { ENV['PARKVIET_PUBLIC_REGISTRATION'] = 'true' }

      it 'creates an admin user and a fresh store ready for immediate login and onboarding' do
        post '/api/v3/admin/pos/registration', params: {
          store_name: 'Cà phê Sáng',
          full_name: 'Nguyễn Văn An',
          email: 'Owner@Example.Test',
          password: 'password123'
        }, as: :json

        expect(response).to have_http_status(:created)

        user_id = response.parsed_body.dig('data', 'user', 'id')
        store_id = response.parsed_body.dig('data', 'store', 'id')
        user = Spree.admin_user_class.find_by_prefix_id!(user_id)
        store = Spree::Store.find_by_prefix_id!(store_id)

        expect(user.email).to eq('owner@example.test')
        expect(user.first_name).to eq('Nguyễn Văn')
        expect(user.last_name).to eq('An')
        expect(store.name).to eq('Cà phê Sáng')
        expect(store).not_to be_default
        expect(default_store.reload).to be_default
        expect(user.spree_admin?(store)).to be(true)
        expect(user.spree_admin?(default_store)).to be(false)
        expect(store.default_market).to have_attributes(currency: 'VND', default_locale: 'vi')
        expect(Spree::TaxCategory.where(store: store, tax_code: %w[deduction.vat_8 deduction.vat_10]).count).to eq(2)

        # Immediately sign in and verify onboarding is ready on the new store
        post '/api/v3/admin/auth/login', params: { email: 'owner@example.test', password: 'password123' }, as: :json
        expect(response).to have_http_status(:ok)
        token = response.parsed_body.fetch('token')

        get '/api/v3/admin/pos/context',
            headers: { 'Authorization' => "Bearer #{token}", 'X-Spree-Store-Id' => store.prefixed_id },
            as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body.dig('onboarding', 'required')).to be(true)
        expect(response.parsed_body.dig('onboarding', 'can_setup')).to be(true)
      end

      it 'rejects duplicate emails without creating a store' do
        create(:admin_user, :without_admin_role, email: 'taken@example.test', password: 'password123')

        expect do
          post '/api/v3/admin/pos/registration', params: {
            store_name: 'Tiệm Bánh',
            email: 'taken@example.test',
            password: 'password123'
          }, as: :json
        end.not_to change(Spree::Store, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body.dig('error', 'code')).to eq('email_taken')
      end

      it 'validates store_name, email and password length' do
        post '/api/v3/admin/pos/registration', params: {
          store_name: '   ',
          email: 'not-an-email',
          password: '123'
        }, as: :json

        expect(response).to have_http_status(:unprocessable_content)
        details = response.parsed_body.dig('error', 'details')
        expect(details).to include('store_name', 'email', 'password')
      end
    end
  end
end
