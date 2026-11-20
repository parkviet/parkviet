# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../support/pos_guest_helpers'
require_relative '../../../support/pos_schema_helpers'

RSpec.describe 'POS e-Menu', type: :request do
  include PosGuestHelpers
  include PosSchemaHelpers

  let(:store) { menu_store }
  let(:branch) { qr_branch(store) }
  let(:area) { area!(branch, name: 'Tầng 1') }
  let(:cashier) { credit_staff(store, branch, PosCreditHelpers::CASHIER + PosGuestHelpers::DECIDER) }
  let(:manager) { credit_staff(store, branch, PosGuestHelpers::MANAGER) }
  let(:table) { table!(area, name: 'Bàn 1') }
  let!(:item) { prepared_product!(store, branch, name: 'Phở bò', price: 55_000) }
  let!(:tea_item) { prepared_product!(store, branch, name: 'Trà đá', price: 10_000) }
  let(:dish) { size(item) }
  let(:tea) { size(tea_item) }

  before do
    allow(Spree::Store).to receive(:default).and_return(store)
    Spree::Pos::GuestViewsController::LIMIT_STORE.clear
    table_register!(branch, cashier)
    kitchen_station!(branch, name: 'Bếp', default: true)
  end

  def bearer(user)
    post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
    { 'Authorization' => "Bearer #{response.parsed_body.fetch('token')}" }
  end

  def staff_put(path, params)
    put "/api/v3/admin/pos/#{path}", headers: bearer(manager).merge('Idempotency-Key' => SecureRandom.uuid), params: params, as: :json
    response
  end

  def setup_vietqr!
    method = Spree::PaymentMethod::Vietqr.create!(store: store, name: 'Chuyển khoản VietQR', active: true)
    method.receiving_accounts.create!(
      provider: 'sepay', bank_bin: '970436', bank_name: 'Vietcombank',
      account_number: '0123456789', account_name: 'PARK VIET', webhook_secret: 'secret_emenu_spec'
    )
    method
  end

  def expect_guest_schema!(name, payload)
    schema = pos_component_schema(name, file: 'pos-guest.yaml')
    errors = JSONSchemer.schema(schema).validate(payload).to_a
    expect(errors).to eq([]), errors.map { |err| err['error'] }.join('; ')
  end

  it 'reads defaults, patches colours, prunes stale item references when menu changes, and validates schemas' do
    get '/api/v3/admin/pos/emenu_settings', headers: bearer(manager), params: { branch_id: branch.prefixed_id }
    expect(response).to have_http_status(:ok)
    expect(JSONSchemer.schema(pos_component_schema('EmenuSettings')).validate(response.parsed_body['data']).to_a).to eq([])
    expect(response.parsed_body.dig('data', 'payment_timing')).to eq('pay_after')
    expect(response.parsed_body.dig('data', 'brand_color')).to eq('#0b6e4f')

    staff_put('emenu_settings', branch_id: branch.prefixed_id, brand_color: '#112233', nope: true)
    expect(response).to have_http_status(:unprocessable_content)

    staff_put('emenu_menu', branch_id: branch.prefixed_id,
                            categories: [{ name: 'Món chính', color: '#aabbcc', items: [item.prefixed_id, tea_item.prefixed_id] }])
    expect(response).to have_http_status(:ok)
    expect(JSONSchemer.schema(pos_component_schema('EmenuCategory')).validate(response.parsed_body.dig('data', 0)).to_a).to eq([])

    staff_put('emenu_settings', branch_id: branch.prefixed_id, brand_color: '#112233', best_seller_item_ids: [tea_item.prefixed_id])
    expect(response).to have_http_status(:ok)

    # Removing tea_item from e-Menu prunes it from best_seller_item_ids so later unrelated updates do not 422
    staff_put('emenu_menu', branch_id: branch.prefixed_id, categories: [{ name: 'Món chính', items: [item.prefixed_id] }])
    expect(response).to have_http_status(:ok)
    staff_put('emenu_settings', branch_id: branch.prefixed_id, paused: true)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'best_seller_item_ids')).to eq([])
    expect(Spree::Pos::AuditEntry.where(action: 'emenu.update').count).to be >= 2
  end

  it 'prints the sticker with area and table name matching the e-Menu configuration' do
    staff_put('emenu_settings', branch_id: branch.prefixed_id, sticker_store_name: 'Quán Phở', sticker_wifi_enabled: true,
                                sticker_wifi_name: 'QuanPho', sticker_wifi_password: '12345678', sticker_size: 'custom', sticker_custom_mm: 58)
    expect(response).to have_http_status(:ok)

    document = Spree::Pos::TableCodes::Issue.document(branch.reload, table, 'https://example.test/table/?t=abc')
    expect(JSONSchemer.schema(pos_component_schema('PrintDocument')).validate(document).to_a).to eq([])
    expect(document['header'].pluck('title')).to eq(['Quán Phở', 'Tầng 1 – Bàn 1'])
    expect(document['footer'].first).to include('kind' => 'qr', 'caption' => 'Quét mã để gọi món/gọi nhân viên')
    expect(document['footer'].last['lines']).to eq(['Wi-Fi: QuanPho', 'Mật khẩu: 12345678'])
  end

  it 'serves and accepts e-Menu items that are not on the counter BranchProduct list' do
    emenu_only = prepared_product!(store, branch, name: 'Bánh tráng riêng QR', price: 25_000)
    Spree::Pos::ProductSetting.create!(store: store, product: emenu_only, qr_orderable: false)
    Spree::Pos::BranchProduct.where(branch_id: branch.id, product_id: emenu_only.id).delete_all
    emenu_variant = size(emenu_only)

    staff_put('emenu_menu', branch_id: branch.prefixed_id, categories: [{ name: 'Đặc biệt QR', color: '#123456', items: [emenu_only.prefixed_id] }])
    expect(response).to have_http_status(:ok)

    workspace = open_table(cashier, table).workspace
    post '/api/v3/pos_guest/session', params: { table_code: table_code!(table).last }, as: :json
    token = response.parsed_body.dig('data', 'token')
    expect_guest_schema!('GuestSession', response.parsed_body['data'].except('token'))

    get '/api/v3/pos_guest/menu', headers: { 'Authorization' => "Guest #{token}" }
    expect(response).to have_http_status(:ok)
    expect_guest_schema!('GuestMenu', response.parsed_body['data'])
    expect(response.parsed_body.dig('data', 'items').pluck('id')).to eq([emenu_only.prefixed_id])

    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: emenu_variant.prefixed_id, quantity: 2 }] }, as: :json
    expect(response).to have_http_status(:created), response.body
    order_id = response.parsed_body.dig('data', 'id')

    post "/api/v3/admin/pos/guest_orders/#{order_id}/accept",
         headers: bearer(cashier).merge('Idempotency-Key' => SecureRandom.uuid), as: :json
    expect(response).to have_http_status(:ok), response.body
    expect(Spree::Pos::SaleLine.where(workspace_id: workspace.id).sum(:sale_quantity)).to eq(2)
  end

  it 'computes 7-day auto best sellers without crashing when items have zero returns' do
    staff_put('emenu_menu', branch_id: branch.prefixed_id,
                            categories: [{ name: 'Món', items: [item.prefixed_id, tea_item.prefixed_id] }])
    staff_put('emenu_settings', branch_id: branch.prefixed_id, best_sellers_enabled: true, best_sellers_source: 'auto', best_sellers_limit: 5)

    completed_ws = open_table(cashier, table).workspace
    Spree::Pos::Workspaces::AppendItems.call(
      workspace: completed_ws, staff: cashier, key: SecureRandom.uuid,
      items: [{ 'variant_id' => tea.prefixed_id, 'quantity' => 4 }, { 'variant_id' => dish.prefixed_id, 'quantity' => 1 }]
    )
    completed_ws.update_columns(operational_status: 'completed')

    Rails.cache.clear
    ids = Spree::Pos::Emenu::BestSellers.ids(branch.reload)
    expect(ids).to eq([tea_item.prefixed_id, item.prefixed_id])
  end

  it 'pauses the menu and enforces min_order_interval_seconds' do
    branch.update!(emenu_settings: Spree::Pos::EmenuSettings.merge({}, 'paused' => true))
    open_table(cashier, table)
    post '/api/v3/pos_guest/session', params: { table_code: table_code!(table).last }, as: :json
    token = response.parsed_body.dig('data', 'token')
    expect(response.parsed_body.dig('data', 'paused')).to be(true)

    get '/api/v3/pos_guest/menu', headers: { 'Authorization' => "Guest #{token}" }
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'code')).to eq('emenu_paused')

    branch.update!(emenu_settings: Spree::Pos::EmenuSettings.merge({}, 'min_order_interval_seconds' => 60, 'paused' => false))
    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: dish.prefixed_id, quantity: 1 }] }, as: :json
    expect(response).to have_http_status(:created)

    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: dish.prefixed_id, quantity: 1 }] }, as: :json
    expect(response).to have_http_status(:too_many_requests)
    expect(response.parsed_body.dig('error', 'details', 'retry_after_seconds')).to be_positive
  end

  it 'settles multiple consecutive VietQR prepay orders at the same table without locking, supports guest cancel, and expires late ones' do
    method = setup_vietqr!
    branch.update!(emenu_settings: Spree::Pos::EmenuSettings.merge({}, 'payment_timing' => 'pay_before', 'prepay_timeout_minutes' => 10))

    # Note: table is NOT manually opened — Mixue-style prepay works directly!
    post '/api/v3/pos_guest/session', params: { table_code: table_code!(table).last }, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig('data', 'status')).to eq('open')
    token = response.parsed_body.dig('data', 'token')

    # Round 1: Phở bò (55,000 VND) via VietQR
    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: dish.prefixed_id, quantity: 1 }], payment: 'vietqr' }, as: :json
    expect(response).to have_http_status(:created), response.body
    expect_guest_schema!('GuestOrder', response.parsed_body['data'])
    expect(response.parsed_body.dig('data', 'status')).to eq('awaiting_payment')

    # Pending staff list excludes awaiting_payment
    get '/api/v3/admin/pos/guest_orders', headers: bearer(cashier), params: { branch_id: branch.prefixed_id }
    expect(response.parsed_body['data']).to eq([])

    round1 = Spree::Pos::GuestOrder.order(:id).last
    event1 = SpreeVietqr::WebhookEvent.create!(
      payment_method: method, receiving_account: method.receiving_accounts.first,
      provider: 'sepay', provider_transaction_id: 'tx-round-1', status: 'unmatched', raw_payload: {}
    )
    tx1 = Struct.new(:raw_content, :provider_transaction_id, :amount_cents, :bank_reference, :account_number).
          new("TT EM#{round1.id}", 'tx-round-1', 55_000, 'REF-R1', '0123456789')

    expect(Spree::Pos::Emenu::ReceivePrepay.call(transaction: tx1, webhook_event: event1, payment_method: method)).to be(true)
    expect(round1.reload.status).to eq('accepted')
    expect(round1.prepaid).to be(true)
    expect(round1.workspace.operational_status).to eq('completed')
    expect(Spree::Pos::KitchenTicket.where(workspace_id: round1.workspace_id)).not_to be_empty

    # Accepted staff list returns the prepaid order matching OpenAPI schema
    get '/api/v3/admin/pos/guest_orders', headers: bearer(cashier), params: { branch_id: branch.prefixed_id, status: 'accepted' }
    expect(response.parsed_body['data'].size).to eq(1)
    expect(JSONSchemer.schema(pos_component_schema('GuestOrder')).validate(response.parsed_body.dig('data', 0)).to_a).to eq([])

    # Round 2 at the SAME table & SAME session: Trà đá (10,000 VND) via VietQR — must NOT fail with snapshot_locked!
    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: tea.prefixed_id, quantity: 2 }], payment: 'vietqr' }, as: :json
    expect(response).to have_http_status(:created), response.body
    round2 = Spree::Pos::GuestOrder.order(:id).last
    event2 = SpreeVietqr::WebhookEvent.create!(
      payment_method: method, receiving_account: method.receiving_accounts.first,
      provider: 'sepay', provider_transaction_id: 'tx-round-2', status: 'unmatched', raw_payload: {}
    )
    tx2 = Struct.new(:raw_content, :provider_transaction_id, :amount_cents, :bank_reference, :account_number).
          new("em#{round2.id}", 'tx-round-2', 20_000, 'REF-R2', '0123456789')
    expect(Spree::Pos::Emenu::ReceivePrepay.call(transaction: tx2, webhook_event: event2, payment_method: method)).to be(true)
    expect(round2.reload.status).to eq('accepted')
    expect(round2.workspace_id).not_to eq(round1.workspace_id)
    expect(round2.workspace.operational_status).to eq('completed')

    # GuestTable shows lines from both paid rounds
    get '/api/v3/pos_guest/order', headers: { 'Authorization' => "Guest #{token}" }
    expect(response).to have_http_status(:ok)
    expect_guest_schema!('GuestTable', response.parsed_body['data'])
    expect(response.parsed_body.dig('data', 'lines').size).to eq(2)
    expect(response.parsed_body.dig('data', 'due')).to eq('0.0')

    # Round 3 canceled by guest, Round 4 expired by job
    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: tea.prefixed_id, quantity: 1 }], payment: 'vietqr' }, as: :json
    round3_id = response.parsed_body.dig('data', 'id')
    post "/api/v3/pos_guest/guest_orders/#{round3_id}/cancel", headers: { 'Authorization' => "Guest #{token}" }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('data', 'status')).to eq('canceled')

    post '/api/v3/pos_guest/guest_orders', headers: { 'Authorization' => "Guest #{token}", 'Idempotency-Key' => SecureRandom.uuid },
                                           params: { items: [{ variant_id: tea.prefixed_id, quantity: 1 }], payment: 'vietqr' }, as: :json
    late = Spree::Pos::GuestOrder.order(:id).last
    late.update!(payment_expires_at: 1.minute.ago)
    Spree::Pos::Emenu::ExpirePrepayJob.perform_now
    expect(late.reload.status).to eq('canceled')
  end

  it 'issues a pay-after bill VietQR and books the bank transfer onto the open table order' do
    method = setup_vietqr!
    workspace = open_table(cashier, table).workspace
    Spree::Pos::Workspaces::AppendItems.call(
      workspace: workspace, staff: cashier, key: SecureRandom.uuid,
      items: [{ 'variant_id' => dish.prefixed_id, 'quantity' => 1 }]
    )

    post '/api/v3/pos_guest/session', params: { table_code: table_code!(table).last }, as: :json
    token = response.parsed_body.dig('data', 'token')

    post '/api/v3/pos_guest/bill_payment', headers: { 'Authorization' => "Guest #{token}" }, as: :json
    expect(response).to have_http_status(:ok), response.body
    qr = response.parsed_body['data']
    expect_guest_schema!('GuestPaymentQr', qr)
    expect(BigDecimal(qr['due'])).to eq(BigDecimal('55000'))

    event = SpreeVietqr::WebhookEvent.create!(
      payment_method: method, receiving_account: method.receiving_accounts.first,
      provider: 'sepay', provider_transaction_id: 'tx-bill-1', status: 'unmatched', raw_payload: {}
    )
    tx = Struct.new(:raw_content, :provider_transaction_id, :amount_cents, :bank_reference, :account_number, :transaction_at).
         new(qr['transfer_content'], 'tx-bill-1', 55_000, 'REF-BILL-1', '0123456789', Time.current)

    expect(Spree::Pos::Collections::ReceiveTransfer.call(transaction: tx, webhook_event: event, payment_method: method)).to be(true)
    expect(event.reload.status).to eq('confirmed')
    expect(Spree::Pos::Emenu::Qr.due(workspace.reload)).to eq(0)

    get '/api/v3/pos_guest/order', headers: { 'Authorization' => "Guest #{token}" }
    expect(response.parsed_body.dig('data', 'due')).to eq('0.0')
    expect(BigDecimal(response.parsed_body.dig('data', 'paid'))).to eq(BigDecimal('55000'))
  end
end
