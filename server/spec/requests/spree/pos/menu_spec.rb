# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_menu_helpers'
require_relative '../../../support/pos_schema_helpers'

# The menu over HTTP: one read for the counter with an etag, the POS data of
# prepared products and store-wide menu changes for menu managers (audited),
# and menu lines added and changed through the item endpoints, every
# response matching pos-staff.yaml.
RSpec.describe 'POS menu API', type: :request do
  include PosMenuHelpers
  include PosSchemaHelpers
  include ActiveSupport::Testing::TimeHelpers

  let(:store) { menu_store }
  let(:branch) { menu_branch(store) }
  let(:manager) { credit_staff(store, branch, [Spree::Pos::Capabilities::MANAGE_MENU]) }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def auth(user, key: nil)
    headers = { 'Authorization' => "Bearer #{token_for(user)}" }
    headers['Idempotency-Key'] = key if key
    headers
  end

  def write(verb, user, path, body = {})
    send(verb, "/api/v3/admin/pos/#{path}", headers: auth(user, key: SecureRandom.uuid), params: body, as: :json)
    response.parsed_body
  end

  def read_menu(user, etag: nil)
    headers = auth(user)
    headers['If-None-Match'] = %("#{etag}") if etag
    get '/api/v3/admin/pos/menu', headers: headers, params: { branch_id: branch.prefixed_id }
    response
  end

  # Noon at the branch, well inside the all-day window below.
  around { |example| travel_to(Time.zone.parse('2026-11-11T05:00:00Z')) { example.run } }

  it 'reads the menu of a branch with categories, sizes, options, favourites and an etag' do
    drinks = till_category!(store, 'Đồ uống')
    tea_tab = Spree::Category.create!(store: store, name: 'Trà sữa', parent: drinks)
    item = prepared_product!(store, branch, name: 'Trà sữa', price: 30_000, sizes: { 'M' => 30_000, 'L' => 36_000 }, category: tea_tab)
    group = modifier_group!(store, item, name: 'Đường', options: { '50%' => 0, '100%' => 0 }, min: 1, defaults: ['100%'])
    # A product of no POS kind sells too, as an ordinary line: no add-ons.
    water = prepared_product!(store, branch, name: 'Nước suối', price: 10_000, category: drinks, type: nil)
    loose = prepared_product!(store, branch, name: 'Kẹo', price: 2_000)
    hidden = prepared_product!(store, branch, name: 'Bánh mì', price: 20_000, category: till_category!(store, 'Bánh'))
    prepared_product!(store, credit_branch(store), name: 'Ở chi nhánh khác', price: 10_000)
    schedule = Spree::Pos::MenuSchedule.create!(store: store, name: 'Cả ngày', starts_at: '00:00', ends_at: '23:59')
    schedule.menu_schedule_items.create!(product: hidden, hidden: true)
    Spree::Pos::MenuFavorite.create!(branch: branch, product: item, position: 0)
    cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)

    expect(read_menu(cashier)).to have_http_status(:ok)
    expect_pos_schema!(response, 'Menu')
    data = response.parsed_body['data']
    expect(data['module_enabled']).to be(true)
    # By first category in tree order, then name; no category last.
    expect(data['items'].map { |row| row['name'] }).to eq(['Nước suối', 'Trà sữa', 'Kẹo'])
    # Only categories with a listed product attached directly; the parent
    # does not take its child's products.
    expect(data['categories']).to eq([
                                       { 'id' => drinks.prefixed_id, 'name' => 'Đồ uống', 'position' => drinks.reload.position, 'parent_id' => nil },
                                       { 'id' => tea_tab.prefixed_id, 'name' => 'Trà sữa', 'position' => tea_tab.reload.position,
                                         'parent_id' => drinks.prefixed_id }
                                     ])
    rows = data['items'].index_by { |row| row['name'] }
    expect(rows['Trà sữa']).to include('product_id' => item.prefixed_id, 'product_kind' => 'prepared', 'kind' => 'single',
                                       'category_ids' => [tea_tab.prefixed_id], 'sold_out' => false,
                                       'modifier_group_ids' => [group.prefixed_id])
    expect(rows['Trà sữa']).not_to have_key('id')
    expect(rows['Trà sữa']['variants'].map { |variant| variant['price'] }).to eq(%w[30000.0 36000.0])
    expect(rows['Nước suối']).to include('product_id' => water.prefixed_id, 'product_kind' => nil, 'category_ids' => [drinks.prefixed_id],
                                         'modifier_group_ids' => [])
    expect(rows['Kẹo']).to include('product_id' => loose.prefixed_id, 'category_ids' => [])
    expect(data['modifier_groups'].sole['options'].map { |option| [option['name'], option['default_selected']] }).
      to eq([['50%', false], ['100%', true]])
    expect(data['favorites']).to eq([item.prefixed_id])

    etag = data['etag']
    expect(response.headers['ETag']).to eq(%("#{etag}"))
    expect(read_menu(cashier, etag: etag)).to have_http_status(:not_modified)
    Spree::Pos::MenuFavorite.delete_all
    expect(read_menu(cashier, etag: etag)).to have_http_status(:ok)
    etag = response.parsed_body.dig('data', 'etag')
    tea_tab.update!(name: 'Trà')
    expect(read_menu(cashier, etag: etag)).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'categories').last['name']).to eq('Trà')

    outsider = credit_staff(store, credit_branch(store), PosCreditHelpers::CASHIER)
    expect(read_menu(outsider)).to have_http_status(:not_found)
  end

  it 'lets a menu manager set the POS data of a prepared product, audited, and nobody else' do
    coffee = prepared_product!(store, branch, name: 'Cà phê sữa', price: 25_000)
    milk = prepared_product!(store, branch, name: 'Sữa tươi', price: 10_000)

    group = write(:post, manager, 'modifier_groups', name: 'Đá', min_select: 0, max_select: 1,
                                                     options: [{ name: 'Ít đá', price_delta: '0' }, { name: 'Không đá', price_delta: '0' }])['data']
    expect(response).to have_http_status(:created)
    expect(group['options'].map { |row| row['name'] }).to eq(['Ít đá', 'Không đá'])

    data = write(:put, manager, "products/#{coffee.prefixed_id}/settings", kitchen_category: 'bar', cup_label: true,
                                                                           drink_credit_categories: [' bar ', ''])['data']
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'ProductPosConfig')
    expect(data).to include('product_id' => coffee.prefixed_id, 'product_kind' => 'prepared', 'kitchen_category' => 'bar',
                            'cup_label' => true, 'qr_orderable' => true, 'drink_credit_categories' => ['bar'])
    # Fields left out keep their value.
    data = write(:put, manager, "products/#{coffee.prefixed_id}/settings", qr_orderable: false)['data']
    expect(data).to include('kitchen_category' => 'bar', 'cup_label' => true, 'qr_orderable' => false)

    data = write(:put, manager, "products/#{coffee.prefixed_id}/modifier_groups", modifier_group_ids: [group['id']])['data']
    expect(response).to have_http_status(:ok), response.body
    expect(data['modifier_group_ids']).to eq([group['id']])

    data = write(:put, manager, "products/#{coffee.prefixed_id}/combo", components: [{ variant_id: size(milk).prefixed_id, quantity: 2 }])['data']
    expect(response).to have_http_status(:ok), response.body
    expect(data['kind']).to eq('combo')
    expect(data['components'].map { |row| [row['variant_id'], row['name'], row['quantity']] }).to eq([[size(milk).prefixed_id, 'Sữa tươi', 2]])
    expect(write(:put, manager, "products/#{coffee.prefixed_id}/combo", components: [])['data']).to include('kind' => 'single', 'components' => [])

    get '/api/v3/admin/pos/products/settings', headers: auth(manager)
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'ProductPosSettings')
    expect(response.parsed_body['data'].map { |row| row['name'] }).to eq(['Cà phê sữa', 'Sữa tươi'])
    expect(response.parsed_body['meta']).to have_key('tax_defaults')

    expect(Spree::Pos::AuditEntry.where(action: 'product_setting.change').count).to eq(2)
    expect(Spree::Pos::AuditEntry.where(action: %w[product_modifier_groups.change product_combo.change]).count).to eq(3)

    # Only a prepared product takes POS data.
    goods = create(:product, store: store, status: 'active', name: 'Nước suối')
    write(:put, manager, "products/#{goods.prefixed_id}/settings", cup_label: true)
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('product_not_prepared')
    write(:put, manager, "products/#{goods.prefixed_id}/modifier_groups", modifier_group_ids: [group['id']])
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('product_not_prepared')
    expect(Spree::Pos::ProductSetting.exists?(product_id: goods.id)).to be(false)
    expect(goods.pos_product_modifier_groups).to be_empty

    write(:put, manager, "products/#{create(:product, store: create(:store)).prefixed_id}/settings", cup_label: true)
    expect(response).to have_http_status(:not_found)
    write(:put, manager, "products/#{coffee.prefixed_id}/settings", kitchen_category: 'Not a category')
    expect(response).to have_http_status(:unprocessable_content)

    kept = group['options'].first
    group = write(:patch, manager, "modifier_groups/#{group['id']}", options: [{ id: kept['id'], name: 'Ít đá', price_delta: '0' },
                                                                               { name: 'Nhiều đá', price_delta: '0' }])['data']
    expect(group['options'].map { |row| row['name'] }).to eq(['Ít đá', 'Nhiều đá'])
    expect(group['options'].first['id']).to eq(kept['id'])

    get '/api/v3/admin/pos/modifier_groups', headers: auth(manager)
    expect_pos_schema!(response, 'ModifierGroup')
    expect(Spree::Pos::AuditEntry.where(action: 'modifier_group.change').count).to eq(2)

    cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)
    write(:put, cashier, "products/#{coffee.prefixed_id}/settings", cup_label: false)
    expect(response).to have_http_status(:forbidden)
    write(:put, cashier, "products/#{coffee.prefixed_id}/combo", components: [])
    expect(response).to have_http_status(:forbidden)
    expect(coffee.reload.pos_setting.cup_label).to be(true)
  end

  it 'keeps option costs and stock marks, shown to menu managers only' do
    item = prepared_product!(store, branch, name: 'Trà sữa', price: 30_000)
    group = write(:post, manager, 'modifier_groups', name: 'Topping', min_select: 1, max_select: 3, allow_quantity: true,
                                                     options: [{ name: 'Trân châu', price_delta: '5000', cost_price: '1500' },
                                                               { name: 'Thạch', price_delta: '4000', cost_price: '', active: false }])['data']
    expect(response).to have_http_status(:created)
    expect(group['options'].map { |row| [row['name'], row['cost_price'], row['active']] }).
      to eq([['Trân châu', '1500.0', true], ['Thạch', nil, false]])
    write(:put, manager, "products/#{item.prefixed_id}/modifier_groups", modifier_group_ids: [group['id']])
    expect(response).to have_http_status(:ok)

    # Editors that leave the cost out keep it.
    pearls = group['options'].first
    write(:patch, manager, "modifier_groups/#{group['id']}", options: [{ id: pearls['id'], name: 'Trân châu', price_delta: '6000' }])
    expect(response.parsed_body.dig('data', 'options').sole).to include('price_delta' => '6000.0', 'cost_price' => '1500.0')
    write(:post, manager, 'modifier_groups', name: 'Sai', options: [{ name: 'Âm', price_delta: '0', cost_price: '-1' }])
    expect(response).to have_http_status(:unprocessable_content)

    get '/api/v3/admin/pos/modifier_groups', headers: auth(manager)
    expect_pos_schema!(response, 'ModifierGroup')
    expect(response.parsed_body['data'].sole['options'].sole).to include('cost_price' => '1500.0')

    cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)
    get '/api/v3/admin/pos/modifier_groups', headers: auth(cashier)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['data'].sole['options'].sole).not_to have_key('cost_price')
    expect(read_menu(cashier).parsed_body.dig('data', 'modifier_groups').sole['options'].sole).not_to have_key('cost_price')
  end

  it 'refuses menu changes while no branch of the store runs the menu' do
    item = prepared_product!(store, branch, name: 'Cà phê', price: 20_000)
    set_pos_module(branch, 'fnb.menu', false)
    write(:put, manager, "products/#{item.prefixed_id}/settings", cup_label: true)
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('module_disabled')
  end

  it 'saves time-of-day menus and favourites' do
    item = prepared_product!(store, branch, name: 'Trà đào', price: 30_000)
    schedule = write(:post, manager, 'menu_schedules', name: 'Giờ vàng', starts_at: '14:00', ends_at: '16:00', days_of_week: [1, 2],
                                                       items: [{ product_id: item.prefixed_id, price: '20000' }])['data']
    expect(response).to have_http_status(:created)
    expect(schedule).to include('starts_at' => '14:00', 'ends_at' => '16:00', 'days_of_week' => [1, 2])
    expect(schedule['items'].sole).to include('product_id' => item.prefixed_id, 'price' => '20000.0')
    write(:post, manager, 'menu_schedules', name: 'Sai', starts_at: '14:00', ends_at: '16:00', days_of_week: [9])
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('menu_schedule_days_invalid')

    lead = credit_staff(store, branch, [Spree::Pos::Capabilities::MANAGE_MENU])
    body = write(:put, lead, 'menu_favorites', branch_id: branch.prefixed_id, product_ids: [item.prefixed_id])
    expect(response).to have_http_status(:ok)
    expect(body['data']).to eq('branch_id' => branch.prefixed_id, 'product_ids' => [item.prefixed_id])
    expect(Spree::Pos::AuditEntry.where(action: 'menu_favorite.change').count).to eq(1)
  end

  it 'adds menu lines with options over HTTP and changes their options' do
    item = prepared_product!(store, branch, name: 'Trà sữa', price: 30_000)
    group = modifier_group!(store, item, name: 'Topping', options: { 'Trân châu' => 5_000, 'Thạch' => 4_000 }, max: 2)
    sale = menu_sale(store, branch)

    add = lambda do |modifiers|
      workspace = sale.workspace.reload
      post "/api/v3/admin/pos/workspaces/#{workspace.prefixed_id}/items", headers: auth(sale.cashier, key: SecureRandom.uuid),
                                                                          params: { expected_revision: workspace.revision, lease_generation: workspace.lease_generation,
                                                                                    editor_id: sale.editor_id, variant_id: size(item).prefixed_id,
                                                                                    quantity: 1, merge: true, modifiers: modifiers, note: 'Ít ngọt' }, as: :json
    end
    add.call([{ option_id: option(group, 'Trân châu').prefixed_id }])
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'Workspace')
    line = response.parsed_body.dig('data', 'line_items').sole
    expect(line).to include('kind' => 'menu', 'unit_price' => '35000.0', 'note' => 'Ít ngọt')

    add.call([{ option_id: 'posmodopt_nope' }])
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('modifier_unknown')

    workspace = sale.workspace.reload
    patch "/api/v3/admin/pos/workspaces/#{workspace.prefixed_id}/items/#{line['sale_line_id']}/modifiers",
          headers: auth(sale.cashier, key: SecureRandom.uuid),
          params: { expected_revision: workspace.revision, lease_generation: workspace.lease_generation, editor_id: sale.editor_id,
                    modifiers: [{ option_id: option(group, 'Thạch').prefixed_id }] }, as: :json
    expect(response).to have_http_status(:ok), response.body
    expect_pos_schema!(response, 'Workspace')
    expect(response.parsed_body.dig('data', 'line_items').sole).to include('unit_price' => '34000.0', 'note' => nil)
  end
end
