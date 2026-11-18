# frozen_string_literal: true

require 'spree/api/testing_support/v3/base'
require_relative '../../../support/pos_shift_helpers'
require_relative '../../../support/pos_trace_helpers'

# HTTP contract for store print templates: who reads and who changes them,
# schema validation with pointers, optimistic versioning, the single default
# per document type, five seeded paper sizes per type, disable-not-delete and
# the audit trail.
RSpec.describe 'POS receipt templates API', type: :request do
  include PosShiftHelpers
  include PosTraceHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { returns_branch(store) }
  let(:admin) { credit_staff(store, branch, [], extra_permissions: %w[read_pos_topology write_pos_topology]) }
  let(:cashier) { credit_staff(store, branch, PosShiftHelpers::LEAD) }

  before { allow(Spree::Store).to receive(:default).and_return(store) }

  def token_for(user)
    @tokens ||= {}
    @tokens[user.id] ||= begin
      post '/api/v3/admin/auth/login', params: { email: user.email, password: 'secret123' }, as: :json
      response.parsed_body.fetch('token')
    end
  end

  def call(user, verb, path, body = {})
    send(verb, "/api/v3/admin/pos/#{path}", headers: { 'Authorization' => "Bearer #{token_for(user)}" },
                                            params: body, as: verb == :get ? nil : :json)
    response.parsed_body
  end

  def staff_with(permissions)
    role = Spree::Role.create!(name: "tpl-#{SecureRandom.hex(4)}", resource: store, permissions: permissions)
    user = Spree.admin_user_class.create!(email: "tpl-#{SecureRandom.hex(6)}@example.test", password: 'secret123',
                                          password_confirmation: 'secret123')
    Spree::RoleUser.create!(role: role, user: user)
    user
  end

  def default_of(type)
    call(admin, :get, 'receipt_templates', { document_type: type })['data'].find { |row| row['is_default'] }
  end

  def error_pointers
    response.parsed_body.dig('error', 'details', 'errors').map { |error| error['pointer'] }
  end

  def audits(action)
    Spree::Pos::AuditEntry.where(store_id: store.id, action: action)
  end

  it 'seeds all five paper sizes per document type, lets branch members read, and refuses every write' do
    list = call(cashier, :get, 'receipt_templates')
    expect(response).to have_http_status(:ok)
    expect(list['data'].map { |row| row['document_type'] }.uniq).to match_array(Spree::Pos::ReceiptTemplate::DOCUMENT_TYPES)
    Spree::Pos::ReceiptTemplate::DOCUMENT_TYPES.each do |type|
      group = list['data'].select { |row| row['document_type'] == type }
      expect(group.map { |row| row['paper'] }).to match_array(Spree::Pos::ReceiptTemplate.papers_for(type))
      expect(group.select { |row| row['is_default'] }.map { |row| row['paper'] }).to eq([Spree::Pos::ReceiptTemplate.default_paper_for(type)])
    end
    sale = list['data'].find { |row| row['document_type'] == 'sale' && row['is_default'] }
    expect(sale).to include('name' => 'Phiếu bán hàng', 'paper' => '80mm', 'status' => 'active', 'is_default' => true,
                            'current_version' => 1, 'version' => 1, 'updated_by' => nil)
    expect(sale['id']).to start_with('postpl_')
    expect(sale['config']).to eq(Spree::Pos::ReceiptTemplate.default_config('sale'))

    sale_a4 = list['data'].find { |row| row['document_type'] == 'sale' && row['paper'] == 'a4' }
    expect(sale_a4).to include('name' => 'Phiếu bán hàng (A4)', 'is_default' => false)
    expect(sale_a4['config']).to eq(Spree::Pos::ReceiptTemplate.default_config('sale', paper: 'a4'))
    expect(sale_a4.dig('config', 'lines', 'layout')).to eq('table')
    expect(sale_a4.dig('config', 'lines', 'ruling')).to eq('grid')

    expect(call(cashier, :get, "receipt_templates/#{sale['id']}", { version: 1 })['data']['version']).to eq(1)
    refunds = call(cashier, :get, 'receipt_templates', { document_type: 'refund' })['data']
    expect(refunds.map { |row| row['document_type'] }.uniq).to eq(['refund'])
    expect(refunds.map { |row| row['paper'] }).to match_array(Spree::Pos::ReceiptTemplate::PAPERS)

    writes = [
      [:post, 'receipt_templates', { from_default: 'sale' }],
      [:patch, "receipt_templates/#{sale['id']}", { expected_version: 1, name: 'X' }],
      [:post, "receipt_templates/#{sale['id']}/duplicate", {}],
      [:post, "receipt_templates/#{sale['id']}/default", {}],
      [:post, "receipt_templates/#{sale['id']}/restore", { version: 1 }],
      [:post, "receipt_templates/#{sale['id']}/disable", {}],
      [:get, "receipt_templates/#{sale['id']}/versions", {}]
    ]
    writes.each do |verb, path, body|
      call(cashier, verb, path, body)
      expect(response).to have_http_status(:forbidden), "#{verb} #{path}"
    end
    call(cashier, :get, 'receipt_templates', { include_disabled: 1 })
    expect(response).to have_http_status(:forbidden)
    expect(Spree::Pos::ReceiptTemplate.for_store(store).count).to eq(39)
    expect(Spree::Pos::AuditEntry.where("action LIKE 'receipt_template.%'")).to be_empty
  end

  it 'lets topology readers without a branch read, and refuses staff with neither' do
    reader = staff_with(%w[read_pos_topology])
    call(reader, :get, 'receipt_templates')
    expect(response).to have_http_status(:ok)
    call(reader, :get, 'receipt_templates', { include_disabled: 1 })
    expect(response).to have_http_status(:ok)
    call(reader, :post, 'receipt_templates', { from_default: 'sale' })
    expect(response).to have_http_status(:forbidden)

    call(staff_with(%w[read_pos_orders write_pos_orders]), :get, 'receipt_templates')
    expect(response).to have_http_status(:forbidden)
  end

  it "answers not found for another store's template" do
    other = create(:store, default_currency: 'VND', supported_currencies: 'VND')
    Spree::Pos::ReceiptTemplate.ensure_defaults!(other)
    foreign = Spree::Pos::ReceiptTemplate.for_store(other).find_by!(document_type: 'sale', is_default: true).prefixed_id
    [[:get, "receipt_templates/#{foreign}", {}], [:get, "receipt_templates/#{foreign}/versions", {}],
     [:patch, "receipt_templates/#{foreign}", { expected_version: 1, name: 'X' }],
     [:post, "receipt_templates/#{foreign}/duplicate", {}], [:post, "receipt_templates/#{foreign}/disable", {}]].each do |verb, path, body|
      call(admin, verb, path, body)
      expect(response).to have_http_status(:not_found), "#{verb} #{path}"
    end
    expect(Spree::Pos::ReceiptTemplate.for_store(other).find_by!(document_type: 'sale', is_default: true).name).to eq('Phiếu bán hàng')
  end

  it 'creates templates from the built-in default or a config, up to ten active per type' do
    created = call(admin, :post, 'receipt_templates', { from_default: 'sale', name: 'K58 Quầy 2', paper: '58mm' })['data']
    expect(response).to have_http_status(:created)
    expect(created).to include('document_type' => 'sale', 'name' => 'K58 Quầy 2', 'paper' => '58mm', 'is_default' => false,
                               'current_version' => 1, 'updated_by' => include('id' => admin.prefixed_id))
    expect(created['config']).to eq(Spree::Pos::ReceiptTemplate.default_config('sale', paper: '58mm'))

    config = Spree::Pos::ReceiptTemplate.default_config('prebill')
    config['footer'] = [{ 'type' => 'text', 'value' => 'Hẹn gặp lại tại {branch.name}', 'align' => 'center' }, { 'type' => 'spacer', 'mm' => 3 }]
    custom = call(admin, :post, 'receipt_templates', { document_type: 'prebill', config: config })['data']
    expect(response).to have_http_status(:created)
    expect(custom).to include('name' => 'Phiếu tạm tính', 'paper' => '80mm', 'config' => config)

    4.times { call(admin, :post, 'receipt_templates', { from_default: 'sale' }) }
    call(admin, :post, 'receipt_templates', { from_default: 'sale' })
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details')).to include('reason' => 'template_limit_reached', 'limit' => 10)
    expect(Spree::Pos::ReceiptTemplate.for_store(store).active.where(document_type: 'sale').count).to eq(10)
    expect(audits('receipt_template.create').count).to eq(6)
    expect(audits('receipt_template.create').first.metadata).to include('id' => created['id'], 'version' => 1)
  end

  it 'creates and edits product labels on label stocks only, validated by the label schema' do
    created = call(admin, :post, 'receipt_templates', { from_default: 'product_label' })['data']
    expect(response).to have_http_status(:created)
    expect(created).to include('document_type' => 'product_label', 'paper' => 'roll_50x30',
                               'name' => 'Tem sản phẩm (50×30mm)', 'is_default' => false)
    expect(created['config']).to eq(Spree::Pos::ReceiptTemplate.default_config('product_label'))

    call(admin, :post, 'receipt_templates', { from_default: 'product_label', paper: '80mm' })
    expect(response).to have_http_status(:unprocessable_content)
    expect(error_pointers).to eq(['/paper'])
    call(admin, :post, 'receipt_templates', { from_default: 'sale', paper: 'roll_50x30' })
    expect(response).to have_http_status(:unprocessable_content)
    expect(error_pointers).to eq(['/paper'])

    config = created['config'].deep_dup
    config['page']['font_size'] = 30
    config['fields'][2]['max_lines'] = 9
    call(admin, :patch, "receipt_templates/#{created['id']}", { expected_version: 1, config: config })
    expect(response).to have_http_status(:unprocessable_content)
    expect(error_pointers).to match_array(['/config/page/font_size', '/config/fields/2/max_lines'])

    config['page']['font_size'] = 8
    config['fields'][2]['max_lines'] = 1
    updated = call(admin, :patch, "receipt_templates/#{created['id']}",
                   { expected_version: 1, config: config, paper: 'sheet_a4_100' })['data']
    expect(response).to have_http_status(:ok)
    expect(updated).to include('paper' => 'sheet_a4_100', 'current_version' => 2)
    call(admin, :patch, "receipt_templates/#{created['id']}", { expected_version: 2, paper: '58mm' })
    expect(response).to have_http_status(:unprocessable_content)

    call(admin, :post, 'receipt_templates', { document_type: 'product_label', config: Spree::Pos::ReceiptTemplate.default_config('sale') })
    expect(response).to have_http_status(:unprocessable_content)
  end

  it 'refuses invalid configs and parameters with a pointer to the problem' do
    config = Spree::Pos::ReceiptTemplate.default_config('shift_closure')
    config['footer'] = [{ 'type' => 'html', 'value' => 'x' }, { 'type' => 'text', 'value' => 'Gọi {store.hotline}' },
                        { 'type' => 'text', 'value' => 'x' * 501 }]
    config['lines'] = Spree::Pos::ReceiptTemplate.default_config('sale')['lines']
    call(admin, :post, 'receipt_templates', { document_type: 'shift_closure', config: config })
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body.dig('error', 'code')).to eq('validation_error')
    expect(error_pointers).to contain_exactly('/config/footer/0/type', '/config/footer/1/value', '/config/footer/2/value', '/config/lines')

    call(admin, :post, 'receipt_templates', { document_type: 'invoice', config: config })
    expect(error_pointers).to eq(['/document_type'])
    call(admin, :post, 'receipt_templates', { from_default: 'sale', paper: 'A3' })
    expect(error_pointers).to eq(['/paper'])
    call(admin, :post, 'receipt_templates', { document_type: 'sale' })
    expect(error_pointers).to eq(['/config'])
    call(admin, :post, 'receipt_templates', { from_default: 'sale', name: 'x' * 61 })
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body['error']).to eq(
      'code' => 'validation_error', 'message' => 'Name must be at most 60 characters.',
      'details' => { 'errors' => [{ 'pointer' => '/name', 'code' => 'too_long', 'message' => 'Name must be at most 60 characters.' }] }
    )
    call(admin, :post, 'receipt_templates', { from_default: 'sale', name: '  ' })
    expect(response.parsed_body.dig('error', 'details',
                                    'errors')).to eq([{ 'pointer' => '/name', 'code' => 'blank', 'message' => 'Name cannot be empty.' }])

    sale = default_of('sale')
    call(admin, :patch, "receipt_templates/#{sale['id']}", { name: 'Không có version' })
    expect(error_pointers).to eq(['/expected_version'])
    call(admin, :patch, "receipt_templates/#{sale['id']}", { expected_version: 1, name: '' })
    expect(response.parsed_body.dig('error', 'details', 'errors').map { |error| [error['pointer'], error['code']] }).to eq([%w[/name blank]])
    call(admin, :patch, "receipt_templates/#{sale['id']}", { expected_version: 1, paper: nil })
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body.dig('error', 'details', 'errors').map { |error| [error['pointer'], error['code']] }).to eq([%w[/paper invalid_value]])
    call(admin, :post, "receipt_templates/#{sale['id']}/duplicate", { name: 'x' * 61 })
    expect(error_pointers).to eq(['/name'])
    expect(Spree::Pos::ReceiptTemplate.find_by_prefix_id(sale['id']).current_version).to eq(1)
    expect(Spree::Pos::ReceiptTemplate.for_store(store).count).to eq(39)
  end

  it 'saves QR, barcode, signature blocks and sale copies, and refuses a QR link that is not http(s)' do
    sale = default_of('sale')
    config = Spree::Pos::ReceiptTemplate.default_config('sale')
    config['page']['copies'] = 2
    config['header'].unshift({ 'type' => 'logo', 'monochrome' => true })
    config['footer'] = [
      { 'type' => 'qr', 'source' => 'url', 'value' => 'https://zalo.me/parkviet', 'caption' => 'Zalo OA' },
      { 'type' => 'qr', 'source' => 'store_social', 'field' => 'facebook', 'align' => 'left' },
      { 'type' => 'barcode' },
      { 'type' => 'signatures', 'parties' => %w[buyer seller], 'labels' => { 'seller' => 'Nhân viên' } }
    ]
    saved = call(admin, :patch, "receipt_templates/#{sale['id']}", { expected_version: 1, config: config })['data']
    expect(response).to have_http_status(:ok)
    expect(saved).to include('current_version' => 2, 'config' => config)

    config['footer'][0]['value'] = 'javascript:alert(1)'
    call(admin, :patch, "receipt_templates/#{sale['id']}", { expected_version: 2, config: config })
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body.dig('error', 'details', 'errors')).to eq(
      [{ 'pointer' => '/config/footer/0/value', 'code' => 'invalid_url', 'message' => 'The link must start with http:// or https://.' }]
    )

    prebill = Spree::Pos::ReceiptTemplate.default_config('prebill')
    prebill['page']['copies'] = 2
    call(admin, :post, 'receipt_templates', { document_type: 'prebill', config: prebill })
    expect(response).to have_http_status(:unprocessable_content)
    expect(error_pointers).to eq(['/config/page/copies'])
    expect(Spree::Pos::ReceiptTemplate.find_by_prefix_id(sale['id']).current_version).to eq(2)
  end

  it 'saves each edit as a new version and refuses a stale expected_version' do
    sale = default_of('sale')
    first = sale['config'].merge('footer' => [{ 'type' => 'text', 'value' => 'Cảm ơn {customer.name}' }])
    saved = call(admin, :patch, "receipt_templates/#{sale['id']}", { expected_version: 1, config: first })['data']
    expect(response).to have_http_status(:ok)
    expect(saved).to include('current_version' => 2, 'version' => 2, 'config' => first)

    other = staff_with(%w[write_pos_topology])
    call(other, :patch, "receipt_templates/#{sale['id']}", { expected_version: 1, config: sale['config'], name: 'Ghi đè' })
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details')).to include('reason' => 'template_version_conflict', 'current_version' => 2)
    template = Spree::Pos::ReceiptTemplate.find_by_prefix_id(sale['id'])
    expect(template.current_config).to eq(first)
    expect(template.name).to eq('Phiếu bán hàng')

    renamed = call(other, :patch, "receipt_templates/#{sale['id']}", { expected_version: 2, name: 'Bán lẻ', paper: 'a5' })['data']
    expect(renamed).to include('current_version' => 3, 'name' => 'Bán lẻ', 'paper' => 'a5', 'config' => first)
    unchanged = call(other, :patch, "receipt_templates/#{sale['id']}", { expected_version: 3, name: 'Bán lẻ' })['data']
    expect(unchanged['current_version']).to eq(3)

    expect(call(admin, :get, "receipt_templates/#{sale['id']}", { version: 1 })['data']['config']).to eq(sale['config'])
    call(admin, :get, "receipt_templates/#{sale['id']}", { version: 9 })
    expect(response).to have_http_status(:not_found)
    history = call(admin, :get, "receipt_templates/#{sale['id']}/versions")
    expect(history['data'].map { |row| row['version'] }).to eq([3, 2, 1])
    expect(history['data'].first['created_by']).to include('id' => other.prefixed_id)
    expect(history['data'].last['created_by']).to be_nil
    expect(audits('receipt_template.update').count).to eq(2)
  end

  it 'duplicates, moves the default, restores versions, respects disabled seeded papers and disables without deleting' do
    initial_sales = call(admin, :get, 'receipt_templates', { document_type: 'sale' })['data']
    sale = initial_sales.find { |row| row['is_default'] }
    initial_sales.reject { |row| row['id'] == sale['id'] }.each do |other|
      call(admin, :post, "receipt_templates/#{other['id']}/disable")
    end

    edited = sale['config'].merge('footer' => [{ 'type' => 'divider', 'style' => 'solid' }])
    call(admin, :patch, "receipt_templates/#{sale['id']}", { expected_version: 1, config: edited })

    copy = call(admin, :post, "receipt_templates/#{sale['id']}/duplicate", { paper: 'a4' })['data']
    expect(response).to have_http_status(:created)
    expect(copy).to include('name' => 'Phiếu bán hàng (bản sao)', 'paper' => 'a4', 'is_default' => false,
                            'current_version' => 1, 'config' => edited)

    made_default = call(admin, :post, "receipt_templates/#{copy['id']}/default")['data']
    expect(made_default['is_default']).to be(true)
    expect(call(admin, :get, "receipt_templates/#{sale['id']}")['data']['is_default']).to be(false)
    call(admin, :post, "receipt_templates/#{copy['id']}/default")
    expect(audits('receipt_template.default').count).to eq(1)
    expect(audits('receipt_template.default').first.metadata).to include('previous_default_id' => sale['id'])

    restored = call(admin, :post, "receipt_templates/#{sale['id']}/restore", { version: 1 })['data']
    expect(restored).to include('current_version' => 3, 'config' => sale['config'])
    call(admin, :post, "receipt_templates/#{sale['id']}/restore", { version: 7 })
    expect(error_pointers).to eq(['/version'])
    call(admin, :post, "receipt_templates/#{sale['id']}/restore", { version: 1, expected_version: 2 })
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('template_version_conflict')

    disabled = call(admin, :post, "receipt_templates/#{copy['id']}/disable")['data']
    expect(disabled).to include('status' => 'disabled', 'is_default' => false)
    expect(call(admin, :get, "receipt_templates/#{sale['id']}")['data']['is_default']).to be(true)
    expect(audits('receipt_template.disable').last.metadata).to include('new_default_id' => sale['id'])
    # Disabled seeded paper sizes stay disabled on subsequent reads.
    expect(call(admin, :get, 'receipt_templates', { document_type: 'sale' })['data'].map { |row| row['id'] }).to eq([sale['id']])
    all = call(admin, :get, 'receipt_templates', { document_type: 'sale', include_disabled: 1 })['data']
    expect(all.map { |row| row['id'] }).to match_array(initial_sales.map { |row| row['id'] } + [copy['id']])
    expect(call(cashier, :get, "receipt_templates/#{copy['id']}")['data']['status']).to eq('disabled')

    call(admin, :patch, "receipt_templates/#{copy['id']}", { expected_version: 1, name: 'Lại' })
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('template_disabled')
    call(admin, :post, "receipt_templates/#{copy['id']}/default")
    expect(response).to have_http_status(:conflict)
    call(admin, :post, "receipt_templates/#{sale['id']}/disable")
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('template_default_required')

    expect(Spree::Pos::ReceiptTemplate.for_store(store).where(document_type: 'sale').count).to eq(6)
    expect(audits('receipt_template.duplicate').first.metadata).to include('source_id' => sale['id'], 'source_version' => 2)
    expect(audits('receipt_template.restore').first.metadata).to include('restored_version' => 1, 'version' => 3)
    expect(audits('receipt_template.disable').count).to eq(5)
  end

  it 'enables a disabled template without making it the default, and refuses past the active limit' do
    sales = call(admin, :get, 'receipt_templates', { document_type: 'sale' })['data']
    other = sales.find { |row| !row['is_default'] }
    call(admin, :post, "receipt_templates/#{other['id']}/disable")

    enabled = call(admin, :post, "receipt_templates/#{other['id']}/enable")['data']
    expect(enabled).to include('status' => 'active', 'is_default' => false)
    expect(audits('receipt_template.enable').count).to eq(1)
    call(admin, :post, "receipt_templates/#{other['id']}/enable")
    expect(audits('receipt_template.enable').count).to eq(1)

    call(admin, :post, "receipt_templates/#{other['id']}/disable")
    (Spree::Pos::ReceiptTemplate::MAX_ACTIVE - Spree::Pos::ReceiptTemplate.for_store(store).active.where(document_type: 'sale').count).times do
      call(admin, :post, "receipt_templates/#{sales.find { |row| row['is_default'] }['id']}/duplicate")
    end
    call(admin, :post, "receipt_templates/#{other['id']}/enable")
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig('error', 'details', 'reason')).to eq('template_limit_reached')

    call(cashier, :post, "receipt_templates/#{other['id']}/enable")
    expect(response).to have_http_status(:forbidden)
  end

  it 'marks branch_default and branch_override distinctly when listing templates for a branch' do
    sale = default_of('sale')
    rows_without = call(cashier, :get, 'receipt_templates', { document_type: 'sale', branch_id: branch.prefixed_id })['data']
    expect(rows_without.length).to eq(5)
    without_override = rows_without.find { |row| row['id'] == sale['id'] }
    expect(without_override).to include('branch_default' => true, 'branch_override' => false)
    expect(rows_without.reject { |row| row['id'] == sale['id'] }).to all(include('branch_default' => false, 'branch_override' => false))

    call(admin, :put, "branches/#{branch.prefixed_id}/receipt_templates", { templates: { sale: sale['id'] } })
    with_override = call(cashier, :get, 'receipt_templates', { document_type: 'sale', branch_id: branch.prefixed_id })['data'].
                    find { |row| row['id'] == sale['id'] }
    expect(with_override).to include('branch_default' => true, 'branch_override' => true)
  end
end
