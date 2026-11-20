# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_kitchen_helpers'
require_relative '../../../support/pos_schema_helpers'

# Marking dishes urgent: staff at the counter by the line's own version,
# people with the kitchen capability and a kitchen screen on the board.
RSpec.describe 'POS kitchen priority API', type: :request do
  include PosKitchenHelpers
  include PosSchemaHelpers

  let(:store) { menu_store }
  let(:branch) { kitchen_branch(store, trigger: 'manual') }
  let(:soup) { prepared_product!(store, branch, name: 'Phở bò', price: 50_000) }
  let(:rice) { prepared_product!(store, branch, name: 'Cơm tấm', price: 45_000) }
  let!(:station) { kitchen_station!(branch, name: 'Bếp', default: true) }
  let(:token) { Spree::Pos::Device.new_token }
  let!(:screen) { kitchen_screen!(branch, token) }
  let(:device) { { 'Authorization' => "Device #{token}" } }
  let(:sale) { menu_sale(store, branch) }
  let(:cook) { credit_staff(store, branch, [Spree::Pos::Capabilities::OPERATE_KITCHEN]) }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def bearer(user)
    post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
    { 'Authorization' => "Bearer #{response.parsed_body.fetch('token')}" }
  end

  def mark_line(line, priority, version: line.reload.row_version, headers: bearer(sale.cashier))
    post "/api/v3/admin/pos/workspaces/#{sale.workspace.prefixed_id}/sale_lines/#{line.prefixed_id}/priority",
         headers: headers.merge('Idempotency-Key' => SecureRandom.uuid), params: { row_version: version, priority: priority }, as: :json
  end

  def sent_ticket
    add_menu(sale, size(soup))
    add_menu(sale, size(rice))
    kitchen_send(sale)
    tickets_of(sale).sole
  end

  it 'marks a line at the counter, checks its version and shows the dish first on the board' do
    ticket = sent_ticket
    line = menu_lines(sale).last
    version = line.row_version

    mark_line(line, true)
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'Workspace')
    expect(response.parsed_body.dig('data', 'line_items').find { |row| row['sale_line_id'] == line.prefixed_id }['priority']).to be(true)
    expect(ticket.items.find { |item| item.sale_line_id == line.id }.reload).to be_priority

    mark_line(line, false, version: version)
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('line_changed')

    get '/api/v3/pos_device/kitchen/board', headers: device, params: { priority: 1 }
    expect_pos_schema!(response, 'KitchenBoard')
    board = response.parsed_body['data']
    expect(board['open'].sole).to include('id' => ticket.prefixed_id, 'priority' => true)
    expect(board['all_day'].sole).to include('name' => 'Cơm tấm', 'priority' => true)
  end

  it 'lets the kitchen mark an item and a ticket on the admin API, and nobody else' do
    ticket = sent_ticket
    first, second = ticket.items.to_a

    post "/api/v3/admin/pos/kitchen/items/#{first.prefixed_id}/priority", headers: bearer(cook), params: { priority: true }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'KitchenTicket')
    expect(response.parsed_body.dig('data', 'items').find { |row| row['id'] == first.prefixed_id }).to include('priority' => true)
    expect(first.reload).to have_attributes(priority: true, priority_by: cook)

    post "/api/v3/admin/pos/kitchen/tickets/#{ticket.prefixed_id}/priority", headers: bearer(cook), params: { priority: true }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect(response.parsed_body['data']['items'].map { |row| row['priority'] }).to eq([true, true])

    post "/api/v3/admin/pos/kitchen/tickets/#{ticket.prefixed_id}/priority", headers: bearer(cook), params: { priority: false }, as: :json
    expect(response.parsed_body['data']['items'].map { |row| row['priority'] }).to eq([false, false])
    expect(second.reload).not_to be_priority

    post "/api/v3/admin/pos/kitchen/items/#{first.prefixed_id}/priority", headers: bearer(sale.cashier), params: { priority: true }, as: :json
    expect(response).to have_http_status(:forbidden)
    expect(first.reload).not_to be_priority
  end

  it 'refuses a finished item and a value that is not true or false' do
    first = sent_ticket.items.first
    Spree::Pos::Kitchen::ChangeItemStatus.call(item: first, action: 'ready', actor: screen)

    post "/api/v3/admin/pos/kitchen/items/#{first.prefixed_id}/priority", headers: bearer(cook), params: { priority: true }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('kitchen_status_invalid')

    open = Spree::Pos::KitchenTicketItem.where.not(id: first.id).sole
    post "/api/v3/admin/pos/kitchen/items/#{open.prefixed_id}/priority", headers: bearer(cook), params: { priority: 'maybe' }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('kitchen_priority_invalid')
  end

  it 'lets a kitchen screen mark items and tickets of its own branch only' do
    ticket = sent_ticket
    first = ticket.items.first

    post "/api/v3/pos_device/kitchen/items/#{first.prefixed_id}/priority", headers: device, params: { priority: true }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'KitchenTicket')
    expect(first.reload).to have_attributes(priority: true, priority_by: screen)

    post "/api/v3/pos_device/kitchen/tickets/#{ticket.prefixed_id}/priority", headers: device, params: { priority: true }, as: :json
    expect(response.parsed_body['data']['items'].map { |row| row['priority'] }).to eq([true, true])

    far_token = Spree::Pos::Device.new_token
    kitchen_screen!(kitchen_branch(store, trigger: 'manual'), far_token)
    far = { 'Authorization' => "Device #{far_token}" }
    post "/api/v3/pos_device/kitchen/tickets/#{ticket.prefixed_id}/priority", headers: far, params: { priority: false }, as: :json
    expect(response).to have_http_status(:not_found)
  end
end
