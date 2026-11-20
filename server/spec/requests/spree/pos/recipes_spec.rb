# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_recipe_helpers'
require_relative '../../../support/pos_schema_helpers'

# Recipes, low-stock thresholds and the two recipe reports over HTTP, every
# response matching pos-staff.yaml.
RSpec.describe 'POS recipes API', type: :request do
  include PosRecipeHelpers
  include PosSchemaHelpers

  let(:store) { menu_store }
  let(:branch) { recipe_branch(store) }
  let(:manager) do
    credit_staff(store, branch, [Spree::Pos::Capabilities::INVENTORY_MANAGE, Spree::Pos::Capabilities::REPORT_READ,
                                 Spree::Pos::Capabilities::REPORT_EXPORT])
  end
  let(:item) { prepared_product!(store, branch, name: 'Trà sữa', price: 30_000, sizes: { 'M' => 30_000, 'L' => 36_000 }) }
  let(:milk) { ingredient!(store, branch, name: 'Sữa tươi', base: 'ml', stock: 1_000, cost: 40) }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def call(user, verb, path, body = {})
    key = SecureRandom.uuid
    send(verb, "/api/v3/admin/pos/#{path}", headers: { 'Authorization' => "Bearer #{token_for(user)}", 'Idempotency-Key' => key },
                                            params: verb == :get ? body : body.merge(idempotency_key: key), as: verb == :get ? nil : :json)
    response.parsed_body
  end

  def business_today
    Spree::Pos::BusinessDay.for(branch, Spree::Pos::Workspace.business_now).iso8601
  end

  it 'saves a recipe version, warns before writing stock off, and reads the history' do
    variant = size(item, 1)
    body = { variant_id: variant.prefixed_id, ingredients: [{ variant_id: milk.prefixed_id, quantity: '0.2', unit_code: 'l' }] }

    call(manager, :put, 'recipes', body)
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('recipe_variant_has_stock')

    call(manager, :put, 'recipes', body.merge(confirm_stock_write_off: true))
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'RecipeOwner')
    expect(response.parsed_body.dig('data', 'active', 'ingredients', 0)).to include('base_quantity' => 200, 'base_unit' => 'ml',
                                                                                    'cost' => '8000.0')

    data = call(manager, :get, 'recipes', variant_id: variant.prefixed_id)
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'RecipeOwner')
    expect(data.dig('data', 'track_inventory')).to be(false)
    expect(data.dig('data', 'versions').map { |row| row['version'] }).to eq([1])

    cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)
    call(cashier, :put, 'recipes', body.merge(confirm_stock_write_off: true))
    expect(response).to have_http_status(:forbidden)
  end

  it "lists the store's active recipes with their cost, searched and narrowed" do
    sugar = ingredient!(store, branch, name: 'Đường', base: 'g', stock: 5_000)
    sugar.update_column(:cost_price, nil)
    medium = size(item, 0)
    large = size(item, 1)
    recipe!(store, manager, medium, [[milk, 150, 'ml'], [sugar, 10, 'g']])
    recipe!(store, manager, large, [[milk, 200, 'ml']])
    # Retiring and saving again leaves only the newest version listed.
    recipe!(store, manager, large, [])
    recipe!(store, manager, large, [[milk, 250, 'ml']])
    group = modifier_group!(store, item, name: 'Topping', options: { 'Kem' => 8_000 })
    cream = option(group, 'Kem')
    recipe!(store, manager, cream, [[milk, 50, 'ml']])
    other_store = menu_store
    other_item = prepared_product!(other_store, recipe_branch(other_store), name: 'Trà sữa khác', price: 30_000)
    Spree::Pos::Recipe.create!(store: other_store, owner: size(other_item, 0), version: 1, active: true)

    data = call(manager, :get, 'recipes/list')
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'RecipeListRow')
    expect(data['data'].map { |row| [row['owner_type'], row['name'], row['options_text'], row['group_name']] }).
      to eq([['modifier_option', 'Kem', nil, 'Topping'], ['variant', 'Trà sữa', medium.options_text, nil],
             ['variant', 'Trà sữa', large.options_text, nil]])
    # Sugar has no cost price, so the medium's cost is unknown.
    expect(data['data'].map { |row| [row['version'], row['ingredients'], row['estimated_cost']] }).
      to eq([[1, 1, '2000.0'], [1, 2, nil], [2, 1, '10000.0']])
    expect(data['data'][2]).to include('owner_id' => large.prefixed_id, 'product_id' => item.prefixed_id, 'track_inventory' => false)
    expect(data['meta']).to include('count' => 3, 'page' => 1)

    expect(call(manager, :get, 'recipes/list', q: 'topp')['data'].map { |row| row['name'] }).to eq(['Kem'])
    expect(call(manager, :get, 'recipes/list', q: large.sku)['data'].map { |row| row['owner_id'] }).to eq([large.prefixed_id])
    expect(call(manager, :get, 'recipes/list', owner_type: 'variant', limit: 1)['meta']).to include('count' => 2, 'next' => 2)
    expect(call(manager, :get, 'recipes/list', variant_ids: "#{large.prefixed_id},#{milk.prefixed_id},#{cream.prefixed_id}")['data'].
      map { |row| row['owner_id'] }).to eq([large.prefixed_id])
    expect(call(manager, :get, 'recipes/list', variant_ids: '')['data']).to eq([])

    call(manager, :get, 'recipes/list', owner_type: 'product')
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('recipe_owner_invalid')

    cream.destroy!
    expect(call(manager, :get, 'recipes/list')['data'].map { |row| row['owner_type'] }).to eq(%w[variant variant])

    cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)
    call(cashier, :get, 'recipes/list')
    expect(response).to have_http_status(:forbidden)
  end

  it 'reads the units and options of every listed ingredient at once' do
    queries = lambda do
      count = 0
      counter = ->(*, payload) { count += 1 if payload[:sql].match?(/spree_pos_variant_units|spree_option_values/) }
      ActiveSupport::Notifications.subscribed(counter, 'sql.active_record') { call(manager, :get, 'recipes/list') }
      expect(response).to have_http_status(:ok)
      count
    end
    recipe!(store, manager, size(item, 0), [[milk, 150, 'ml']])
    one = queries.call

    sugar = ingredient!(store, branch, name: 'Đường', base: 'g', stock: 5_000, cost: 20)
    tea = ingredient!(store, branch, name: 'Trà', base: 'g', stock: 5_000, cost: 30)
    recipe!(store, manager, size(item, 1), [[milk, 200, 'ml'], [sugar, 10, 'g'], [tea, 5, 'g']])
    expect(queries.call).to eq(one)
  end

  it 'sets thresholds, lists low ones first and removes one' do
    sugar = ingredient!(store, branch, name: 'Đường', base: 'g', stock: 5_000)
    call(manager, :put, 'stock_alerts', branch_id: branch.prefixed_id, variant_id: sugar.prefixed_id, min_quantity: 1_000)
    data = call(manager, :put, 'stock_alerts', branch_id: branch.prefixed_id, variant_id: milk.prefixed_id, min_quantity: 2_000)
    expect(response).to have_http_status(:ok)
    expect_pos_schema!(response, 'StockAlert')
    expect(data['data'].map { |row| [row['name'], row['low'], row['on_hand']] }).to eq([['Sữa tươi', true, 1_000], ['Đường', false, 5_000]])

    call(manager, :put, 'stock_alerts', branch_id: branch.prefixed_id, variant_id: milk.prefixed_id, min_quantity: nil)
    expect(call(manager, :get, 'stock_alerts', branch_id: branch.prefixed_id)['data'].map { |row| row['name'] }).to eq(['Đường'])
    expect(Spree::Pos::AuditEntry.where(action: 'stock_alert.change').count).to eq(3)

    set_pos_module(branch, 'fnb.recipes', false)
    call(manager, :put, 'stock_alerts', branch_id: branch.prefixed_id, variant_id: milk.prefixed_id, min_quantity: 10)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('module_disabled')
  end

  it 'counts the own cost of options without a recipe in the margin and the below-cost warning' do
    group = modifier_group!(store, item, name: 'Topping', options: { 'Trân châu' => 5_000, 'Kem' => 8_000 }, max: 3, allow_quantity: true)
    pearls = option(group, 'Trân châu')
    pearls.update!(cost_price: 1_500)
    cream = option(group, 'Kem')
    cream.update!(cost_price: 9_999)
    # The recipe counts what the cream uses, so its own cost stays out.
    recipe!(store, manager, cream, [[milk, 50, 'ml']])
    sale = menu_sale(store, branch)
    add_menu(sale, size(item, 0), quantity: 2, modifiers: picks([pearls, 2], [cream, 1]))
    line = menu_lines(sale).sole
    expect(line.line_modifiers.map { |pick| [pick.name, pick.cost_price] }).to contain_exactly(['Trân châu', 1_500], ['Kem', nil])
    pay_and_complete(sale)

    data = call(manager, :get, 'reports/menu_margin', branch_id: branch.prefixed_id, from: business_today, to: business_today)
    expect(response).to have_http_status(:ok)
    expect(data['data'].map { |row| [row['product'], row['quantity'], row['revenue'], row['cost'], row['costed']] }).
      to eq([['Trà sữa · Size: M', 2, '96000.0', '10000.0', true]])

    allow(Spree::Pos::SalesSettings).to receive(:for).and_return({ 'warn_below_cost' => true })
    expect(line.reload.below_cost?).to be(false)
    line.line_modifiers.find_by!(name: 'Trân châu').update!(cost_price: 30_000)
    expect(line.reload.below_cost?).to be(true)
  end

  describe 'reports' do
    before do
      recipe!(store, manager, size(item, 0), [[milk, 150, 'ml']])
      recipe!(store, manager, size(item, 1), [[milk, 200, 'ml']])
      sale = menu_sale(store, branch)
      add_menu(sale, size(item, 1), quantity: 2)
      add_menu(sale, size(item, 0))
      pay_and_complete(sale)
    end

    it 'reports ingredient usage by day, ingredient and item' do
      data = call(manager, :get, 'reports/ingredient_usage', branch_id: branch.prefixed_id, from: business_today, to: business_today)
      expect(response).to have_http_status(:ok)
      expect_pos_schema!(response, 'IngredientUsageRow')
      expect(data['data'].map { |row| [row['product'], row['quantity'], row['unit'], row['cost']] }).
        to contain_exactly(['Trà sữa · Size: L', 400, 'ml', '16000.0'], ['Trà sữa · Size: M', 150, 'ml', '6000.0'])
      expect(data.dig('meta', 'summary')).to include('total_cost' => '22000.0', 'shortages' => 0)
      expect(data.dig('meta', 'summary', 'ingredients').sole).to include('quantity' => 550, 'unit' => 'ml')
    end

    it 'reports the margin of each size, and exports it' do
      data = call(manager, :get, 'reports/menu_margin', branch_id: branch.prefixed_id, from: business_today, to: business_today)
      expect(response).to have_http_status(:ok)
      expect_pos_schema!(response, 'MenuMarginRow')
      expect(data['data'].map { |row| [row['product'], row['quantity'], row['revenue'], row['cost'], row['margin']] }).
        to eq([['Trà sữa · Size: L', 2, '72000.0', '16000.0', '56000.0'], ['Trà sữa · Size: M', 1, '30000.0', '6000.0', '24000.0']])
      expect(data.dig('meta', 'summary')).to include('revenue' => '102000.0', 'cost' => '22000.0', 'margin' => '80000.0')

      created = call(manager, :post, 'exports', branch_id: branch.prefixed_id, report_type: 'menu_margin',
                                                filters: { from: business_today, to: business_today })
      expect(response).to have_http_status(:accepted)
      export = Spree::Pos::ExportRequest.find_by_prefix_id!(created.dig('data', 'id'))
      Spree::Pos::GenerateExportJob.perform_now(export.id)
      expect(export.reload).to have_attributes(status: 'ready', row_count: 2)
    end
  end
end
