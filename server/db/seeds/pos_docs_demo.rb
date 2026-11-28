# frozen_string_literal: true

# Dữ liệu mẫu tiếng Việt sạch phục vụ chụp ảnh & viết HDSD ParkViet (chỉ chạy ở development).
#
# Cách chạy từ thư mục gốc repo `parkviet`:
#   pnpm spree exec bin/rails runner db/seeds/pos_docs_demo.rb
#
# Script idempotent: nếu chi nhánh `docs-minh-an` đã tồn tại thì giữ nguyên, không tạo trùng.

abort 'Chỉ chạy dữ liệu mẫu HDSD ở môi trường development.' unless Rails.env.development?

store = Spree::Store.default
Spree::Current.store = store

BRANCH_CODE = 'docs-minh-an'
DEMO_EMAIL = 'admin@minhan.local'
DEMO_PASSWORD = 'ParkVietDemo2026!'

# Tạo tài khoản demo sạch (không dùng email cá nhân thật trên ảnh chụp HDSD)
actor = Spree.admin_user_class.find_by(email: DEMO_EMAIL)
if actor.nil?
  actor = Spree.admin_user_class.create!(
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    password_confirmation: DEMO_PASSWORD
  )
  actor.update!(first_name: 'Nguyễn', last_name: 'Minh An') if actor.respond_to?(:first_name=)
end

# Đảm bảo tài khoản có vai trò quản trị trên cửa hàng mặc định
admin_role = Spree::Role.find_by(name: 'admin', resource: store) ||
             Spree::Role.find_by(name: 'admin') ||
             Spree::Role.create!(name: 'admin', resource: store)
Spree::RoleUser.find_or_create_by!(user: actor, role: admin_role)

# Đảm bảo cửa hàng có phương thức thanh toán thủ công đang bật để POS thu Tiền mặt / Chuyển khoản
unless Spree::PaymentMethod.where(store_id: store.id, active: true, deleted_at: nil).where('type ILIKE ?', '%Check%').exists?
  Spree::PaymentMethod::Check.create!(
    store: store,
    name: 'Tiền mặt / Chuyển khoản POS',
    active: true,
    display_on: 'both'
  )
end

if Spree::Pos::Branch.for_store(store).exists?(code: BRANCH_CODE)
  branch = Spree::Pos::Branch.for_store(store).find_by!(code: BRANCH_CODE)
  Spree::Pos::StaffMembership.find_or_create_by!(store: store, branch: branch, staff: actor) do |m|
    m.capabilities = Spree::Pos::Capabilities::ASSIGNABLE
    m.status = 'active'
  end
  puts({
    status: 'exists',
    branch: branch.name,
    branch_code: branch.code,
    login_email: DEMO_EMAIL,
    currency: store.default_currency
  }.inspect)
  exit
end

ActiveRecord::Base.transaction do
  Spree::Pos::TaxCategories.seed!(store) if defined?(Spree::Pos::TaxCategories)

  location = Spree::StockLocation.create!(
    store: store,
    name: 'Kho Tạp hóa Minh An',
    address1: '128 Nguyễn Trãi, Thanh Xuân',
    city: 'Hà Nội',
    zipcode: '100000',
    country_code: 'VN',
    active: true,
    backorderable_default: false,
    propagate_all_variants: false
  )

  branch = Spree::Pos::Branches::Create.call(
    store: store,
    actor: actor,
    profile_key: 'tap_hoa_sieu_thi',
    attributes: {
      name: 'Tạp hóa Minh An',
      code: BRANCH_CODE,
      timezone: 'Asia/Ho_Chi_Minh',
      stock_location: location
    }
  )

  register_main = Spree::Pos::Register.create!(
    store: store,
    branch: branch,
    name: 'Quầy 1 - Chính',
    code: 'minh-an-q1',
    status: 'active'
  )
  Spree::Pos::Register.create!(
    store: store,
    branch: branch,
    name: 'Quầy 2 - Phụ',
    code: 'minh-an-q2',
    status: 'active'
  )

  Spree::Pos::StaffMembership.find_or_create_by!(store: store, branch: branch, staff: actor) do |m|
    m.capabilities = Spree::Pos::Capabilities::ASSIGNABLE
    m.status = 'active'
  end

  # Cũng gán cho admin đầu tiên nếu có để chủ máy dùng tài khoản sẵn có vẫn vào được
  first_admin = Spree.admin_user_class.order(:id).first
  if first_admin && first_admin.id != actor.id
    Spree::Pos::StaffMembership.find_or_create_by!(store: store, branch: branch, staff: first_admin) do |m|
      m.capabilities = Spree::Pos::Capabilities::ASSIGNABLE
      m.status = 'active'
    end
  end

  # Danh mục hàng hóa phổ biến cho tạp hóa & siêu thị mini
  top_level = Spree::Category.where(store_id: store.id, parent_id: nil).to_a
  categories = ['Thực phẩm khô', 'Đồ uống & Sữa', 'Gia vị & Dầu ăn', 'Hóa mỹ phẩm'].to_h do |name|
    [name, top_level.find { |c| c.name == name } || Spree::Category.create!(store: store, name: name)]
  end

  channel = Spree::Pos::SalesChannel.ensure!(store)

  catalog = [
    ['Thực phẩm khô', 'Gạo ST25 túi 5kg', 'MA-GAO-5KG', '8936001000011', 165_000, 40],
    ['Thực phẩm khô', 'Mì Hảo Hảo tôm chua cay (gói)', 'MA-MI-HH', '8934563138165', 4_500, 240],
    ['Thực phẩm khô', 'Trứng gà ta hộp 10 quả', 'MA-TRUNG-10', '8936001000028', 38_000, 35],
    ['Thực phẩm khô', 'Bánh quy bơ Danisa hộp 454g', 'MA-BANH-454', '8936001000035', 142_000, 18],
    ['Đồ uống & Sữa', 'Sữa tươi Vinamilk không đường 1L', 'MA-SUA-1L', '8934673100117', 34_000, 60],
    ['Đồ uống & Sữa', 'Nước khoáng LaVie 500ml', 'MA-LAVIE-500', '8935001712015', 6_000, 180],
    ['Đồ uống & Sữa', 'Cà phê hòa tan G7 hộp 18 gói', 'MA-CF-G7', '8935024133101', 62_000, 45],
    ['Đồ uống & Sữa', 'Trà xanh Không Độ chai 455ml', 'MA-TRA-KD', '8934753002010', 10_000, 120],
    ['Gia vị & Dầu ăn', 'Nước mắm Nam Ngư chai 750ml', 'MA-NM-750', '8936017360016', 44_000, 50],
    ['Gia vị & Dầu ăn', 'Dầu ăn Neptune Light chai 1L', 'MA-DAU-1L', '8934988010018', 58_000, 48],
    ['Gia vị & Dầu ăn', 'Đường tinh luyện Biên Hòa 1kg', 'MA-DUONG-1KG', '8934636000010', 29_000, 55],
    ['Hóa mỹ phẩm', 'Nước giặt OMO Matic túi 3.6kg', 'MA-OMO-36', '8934868142102', 195_000, 24],
    ['Hóa mỹ phẩm', 'Giấy vệ sinh Pulppy lốc 10 cuộn', 'MA-GIAY-10', '8935012010018', 88_000, 32],
    ['Hóa mỹ phẩm', 'Nước rửa chén Sunlight chanh 750g', 'MA-SL-750', '8934868112013', 32_000, 42]
  ]

  catalog.each do |cat_name, name, sku, barcode, price, qty|
    product = Spree::Product.new(store: store, name: name, status: 'active')
    variant = product.build_default_variant(sku: sku, barcode: barcode)
    variant.product = product
    product.save!
    product.default_variant.set_price(store.default_currency, price)
    Spree::ProductPublication.find_or_create_by!(product: product, channel: channel)
    Spree::Pos::BranchProduct.create!(branch: branch, product: product)
    product.product_categories.create!(category: categories[cat_name])
    location.restock(product.default_variant, qty)
  end

  # Mở sẵn 1 ca bán hàng với tiền đầu ca 1.000.000 đ để vào chụp màn hình bán hàng ngay
  shift = Spree::Pos::Shifts::Open.call(
    store: store,
    staff: actor,
    register: register_main,
    opening_float: '1000000'
  )

  puts({
    status: 'ok',
    branch: branch.name,
    branch_code: branch.code,
    login_email: DEMO_EMAIL,
    registers: 2,
    products: catalog.length,
    shift_id: shift.respond_to?(:prefixed_id) ? shift.prefixed_id : shift,
    currency: store.default_currency
  }.inspect)
end
