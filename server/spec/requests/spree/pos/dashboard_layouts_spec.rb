# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_shift_helpers'
require_relative '../../../support/pos_schema_helpers'

# Each dashboard user keeps their own arrangement of the dashboard home
# widgets per store: saved whole, checked for shape, never visible to
# another user or another store.
RSpec.describe 'POS dashboard layout API', type: :request do
  include PosShiftHelpers
  include PosSchemaHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:owner) { credit_staff(store, branch, PosShiftHelpers::LEAD) }
  let(:colleague) { credit_staff(store, branch, PosShiftHelpers::LEAD) }
  let(:layout) do
    [
      { 'id' => 'sales-1', 'widget' => 'sales_total', 'x' => 0, 'y' => 0, 'w' => 6, 'h' => 2 },
      { 'id' => 'trend-1', 'widget' => 'trend', 'x' => 6, 'y' => 0, 'w' => 6, 'h' => 4, 'options' => { 'tab' => 'orders' } }
    ]
  end

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def call(user, verb, body = nil, headers: {})
    send(verb, '/api/v3/admin/pos/dashboard_layout', headers: { 'Authorization' => "Bearer #{token_for(user)}" }.merge(headers),
                                                     params: body, as: :json)
    response.parsed_body.presence
  end

  def item(**overrides)
    { 'id' => 'a', 'widget' => 'sales_total', 'x' => 0, 'y' => 0, 'w' => 3, 'h' => 2 }.merge(overrides.stringify_keys)
  end

  it 'returns null until a layout is saved, then the saved layout, and null again after a reset' do
    expect(call(owner, :get)).to eq('data' => nil)
    expect(response).to have_http_status(:ok)

    saved = call(owner, :put, { layout: layout })['data']
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'DashboardLayout')
    expect(saved).to include('layout' => layout, 'version' => 1)

    fetched = call(owner, :get)['data']
    expect_pos_schema!(response, 'DashboardLayout')
    expect(fetched).to eq(saved)

    replaced = call(owner, :put, { layout: [item] })['data']
    expect(replaced['layout']).to eq([item])
    expect(Spree::Pos::DashboardLayout.where(user_id: owner.id).count).to eq(1)

    call(owner, :delete)
    expect(response).to have_http_status(:no_content)
    expect(call(owner, :get)).to eq('data' => nil)
    call(owner, :delete)
    expect(response).to have_http_status(:no_content)
  end

  it 'accepts an empty layout' do
    expect(call(owner, :put, { layout: [] })['data']['layout']).to eq([])
    expect(response).to have_http_status(:ok)
  end

  {
    'a cell past the last column' => [{ x: 8, w: 6 }],
    'a zero width' => [{ w: 0 }],
    'a width over the grid' => [{ x: 0, w: 13 }],
    'a negative row' => [{ y: -1 }],
    'a height over the limit' => [{ h: 21 }],
    'a string coordinate' => [{ x: '1' }],
    'a fractional size' => [{ w: 2.5 }],
    'an uppercase widget name' => [{ widget: 'SalesTotal' }],
    'a widget name with a path' => [{ widget: '../x' }],
    'an empty id' => [{ id: '' }],
    'options that are not an object' => [{ options: [1] }],
    'options over 2 KB' => [{ options: { 'note' => 'x' * 2100 } }]
  }.each do |label, (overrides)|
    it "refuses #{label}" do
      body = call(owner, :put, { layout: [item(**overrides)] })
      expect(response).to have_http_status(:unprocessable_content)
      expect(body.dig('error', 'code')).to eq('validation_error')
      expect(Spree::Pos::DashboardLayout.count).to eq(0)
    end
  end

  it 'refuses too many cells, duplicate ids, unknown keys, a missing field and a missing layout' do
    too_many = Array.new(51) { |index| item(id: "w#{index}", y: index) }
    [
      too_many,
      [item(id: 'same'), item(id: 'same', x: 3)],
      [item.merge('extra' => true)],
      [item.except('h')],
      ['not an object'],
      'not a list'
    ].each do |bad|
      call(owner, :put, { layout: bad })
      expect(response).to have_http_status(:unprocessable_content), "accepted #{bad.inspect.first(80)}"
    end
    call(owner, :put, { other: [] })
    expect(response).to have_http_status(:unprocessable_content)
    expect(Spree::Pos::DashboardLayout.count).to eq(0)
  end

  it 'keeps a saved layout when a later save is refused' do
    call(owner, :put, { layout: layout })
    call(owner, :put, { layout: [item(w: 99)] })
    expect(response).to have_http_status(:unprocessable_content)
    expect(call(owner, :get)['data']['layout']).to eq(layout)
  end

  it "never shows or changes another user's layout" do
    call(owner, :put, { layout: layout })

    expect(call(colleague, :get)).to eq('data' => nil)
    call(colleague, :put, { layout: [item] })
    expect(call(owner, :get)['data']['layout']).to eq(layout)

    call(colleague, :delete)
    expect(call(owner, :get)['data']['layout']).to eq(layout)
    expect(call(colleague, :get)).to eq('data' => nil)
  end

  it 'keeps one layout per store for the same user' do
    other = create(:store, default_currency: 'VND', supported_currencies: 'VND')
    role = Spree::Role.create!(name: "layout-#{SecureRandom.hex(4)}", resource: other, permissions: %w[read_pos_orders])
    Spree::RoleUser.create!(role: role, user: owner)
    Spree::Pos::StaffMembership.create!(store: other, branch: credit_branch(other), staff: owner,
                                        capabilities: PosShiftHelpers::LEAD, status: 'active')
    elsewhere = { 'X-Spree-Store-Id' => other.prefixed_id }

    call(owner, :put, { layout: layout })
    expect(call(owner, :get, headers: elsewhere)).to eq('data' => nil)
    expect(response).to have_http_status(:ok)

    call(owner, :put, { layout: [item] }, headers: elsewhere)
    expect(call(owner, :get, headers: elsewhere)['data']['layout']).to eq([item])
    expect(call(owner, :get)['data']['layout']).to eq(layout)

    call(owner, :delete, headers: elsewhere)
    expect(call(owner, :get)['data']['layout']).to eq(layout)
  end

  it 'refuses users without POS access and staff of another store' do
    role = Spree::Role.create!(name: "no-pos-#{SecureRandom.hex(4)}", resource: store, permissions: %w[read_products])
    plain = Spree.admin_user_class.create!(email: "plain-#{SecureRandom.hex(6)}@example.test", password: 'secret123',
                                           password_confirmation: 'secret123')
    Spree::RoleUser.create!(role: role, user: plain)

    foreign = create(:store, default_currency: 'VND', supported_currencies: 'VND')
    stranger = credit_staff(foreign, credit_branch(foreign), PosShiftHelpers::LEAD)

    [plain, stranger].each do |user|
      %i[get put delete].each do |verb|
        call(user, verb, verb == :put ? { layout: layout } : nil)
        expect(response).to have_http_status(:forbidden), "#{user.email} #{verb}: #{response.status}"
      end
    end
    expect(Spree::Pos::DashboardLayout.count).to eq(0)
  end
end
