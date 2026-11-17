# Tab "Chức năng" của chi nhánh theo bố cục "Quy trình bán hàng"

Trạng thái: đã triển khai. Xem ghi chú ở cuối file.

Tên tab vẫn là **Chức năng**.

## Quyết định đã chốt

1. Đổi cài đặt bán hàng mới (`sales_settings`) **không cần nhập lý do**, nhưng vẫn ghi audit. Module và cờ rủi ro vẫn bắt lý do như hiện nay.
2. **"Cho phép bán khi hết tồn kho" làm luôn trong plan này.**
3. `sales_settings` **chỉ lưu theo chi nhánh**. Chi nhánh mới dùng mặc định có trong mã, không có mặc định cấp cửa hàng.
4. Xem giá vốn cần **capability mới `pos.cost.view`**, gán qua nhóm quyền.

## Mục tiêu

Hôm nay tab Chức năng (`/branches/$branchId/features`) là ba khối xếp chồng: "Chức năng theo ngành" (module), "Chức năng chi nhánh" (cờ tính năng có rủi ro) và "Mẫu tem cân". Người dùng phải biết trước một công tắc thuộc loại nào thì mới tìm được. Một số cấu hình bán hàng còn nằm rải ở các tab khác (Bếp & bar, Sơ đồ bàn, In ấn) hoặc chỉ lưu trên từng máy (tự in hoá đơn).

Sau plan này, tab Chức năng được tổ chức theo **việc người bán làm**:

1. Quy trình bán hàng
2. Quy tắc bán hàng
3. Thiết lập khi bán hàng
4. Tiện ích bán hàng
5. Tự động in
6. Xử lý đơn hàng

Mỗi nhóm là một `ModelCard`. Trên màn hình rộng (`lg`), bên phải có mục lục dính (sticky) để nhảy giữa các nhóm.

## Hiện trạng (đã đọc mã)

- **Module theo ngành**: `config/initializers/pos_modules.rb` (21 module, có `depends_on`), bật/tắt theo chi nhánh qua `BranchModules::Set`. Mỗi lần đổi cần lý do và ghi audit `branch_module.change`. UI: `ModuleSwitches` trong `pages/business-model.tsx`, được bọc bởi `BranchModuleSwitches`.
- **Cờ tính năng có rủi ro**: `POS_FEATURES` (13 cờ) trong `packages/pos-shared/src/pos-features.ts` và bảng `spree_pos_feature_flags`. Cửa hàng đặt giá trị mặc định, chi nhánh chỉ được tắt riêng. Mỗi lần đổi cần lý do. UI: `FeatureSwitchRow` trong `components/feature-switch-row.tsx`.
- **Cột cấu hình của chi nhánh** (`spree_pos_branches`) đã có: `kitchen_send_trigger`, `service_charge_rate`, `qr_order_mode` / `qr_order_auto_*`, `kiosk_kitchen_before_payment`, `return_window_days`, `lot_selection`, `cup_label_settings`. Chúng được sửa ở các tab Bếp & bar, Sơ đồ bàn và ở hộp thoại Sửa thông tin.
- **Tự in hoá đơn bán** là cài đặt của từng máy, lưu trong `localStorage` (`apps/pos/src/lib/receipt-preferences.ts`, `AUTO_PRINT_KEY`). Chi nhánh không có giá trị mặc định.
- **Phiếu tạm tính** đã có (`print_documents/prebill.rb`). Ghi chú đơn (`workspaces.note`), mã giảm giá (`workspaces/apply_coupon.rb`), số thứ tự theo ngày (`fnb.order_number`) và âm báo quét mã (`lib/scan-sounds.ts`) cũng đã có.
- **Tồn kho trên màn bán**: `catalog-search.tsx` luôn hiện `stock_on_hand`. Màn bán không hiện giá vốn ở đâu cả.
- **Bán khi hết tồn hôm nay luôn được phép tại quầy.** `Workspaces::ManageLineItem` không kiểm tồn khi thêm hoặc tăng dòng. Nó chỉ kiểm hàng còn được bán (`sellable_variant!`), món hết (`Menu.ensure_line_available!`) và hàng serial/lô (`StockIntegration.ensure_sellable!`). Khi bàn giao, `Orders::Handover` thấy kệ thiếu thì không chặn: phần thiếu được ghi thành `StockDiscrepancy` (`source: handover`) và giao lại sau khi đã chỉnh tồn (`ReconcileHandover`). Kệ hệ thống không bao giờ âm. Nguyên liệu công thức dùng quá tồn được ghi `source: recipe`.

## Bảng đối chiếu tính năng

Trạng thái: **Có** = đã có, chỉ đưa vào đúng nhóm. **Chuyển** = đang ở tab khác, đưa ra đây dưới dạng dòng tóm tắt kèm nút "Thiết lập". **Mới** = làm trong plan này. **Không** = không làm, kèm lý do.

### 1. Quy trình bán hàng (module theo ngành)

| Tham khảo | Parkviet | Trạng thái |
|---|---|---|
| Quy trình bán hàng ngành FnB (công tắc cha) | Tiêu đề nhóm **Ăn uống** / **Bán lẻ**, không có công tắc. Bật cả nhóm là việc của đổi ngành ở Tổng quan | Có (chỉ đổi cách hiển thị) |
| Quản lý bếp + nút "Thiết lập bếp" | `fnb.kitchen`, nút "Thiết lập" mở tab Bếp & bar | Có + Chuyển |
| In báo bếp & tem món | `fnb.cup_label` lồng dưới `fnb.menu`, nút "Thiết lập" mở cài đặt tem ly | Có |
| In cả món đã huỷ | Kiểm tra `kitchen/void_sent.rb`. Nếu phiếu huỷ đã luôn được in thì chỉ ghi rõ trong mô tả của `fnb.kitchen`, không thêm cờ | Kiểm tra |
| (không có) | Hàng cân / Quy đổi đơn vị / Serial-lô. "Mẫu tem cân" chuyển thành khối con lồng dưới `retail.measured` | Có |

Module con lồng dưới module cha theo `depends_on`, ví dụ `fnb.menu` → `fnb.kitchen`, `fnb.recipes`, `fnb.cup_label`, `fnb.delivery_platforms`. Khi cha đang tắt, con hiện mờ kèm dòng "Cần bật X trước".

### 2. Quy tắc bán hàng (cờ rủi ro + quy tắc)

| Tham khảo | Parkviet | Trạng thái |
|---|---|---|
| Cho phép bán khi hết tồn kho | `allow_oversell`, mặc định `true` (đúng hành vi hiện nay). Khi tắt, quầy từ chối thêm hoặc tăng dòng vượt tồn hệ thống của kho chi nhánh, và kiểm lại khi chốt đơn. Có cảnh báo "Không áp dụng cho hàng theo serial/lô và món trong thực đơn". Xem mục "Chặn bán vượt tồn" | **Mới** |
| Cho phép cập nhật tồn khi hết hàng | Kiểm kê đã cho làm | Không |
| Cảnh báo giá vốn cao hơn giá bán | `warn_below_cost`: chỉ nhắc khi thêm dòng hoặc giảm giá xuống dưới `cost_price`, không chặn | **Mới** |
| Cho xem / chỉnh ngày tạo đơn | `business_date` suy ra từ ca và giờ chốt ngày. Cho sửa sẽ làm sai chốt ca và báo cáo | **Không** |
| Mã đơn hàng (đặt lại theo ngày) | `fnb.order_number` hiện ở đây dưới dạng dòng chỉ đọc "Số thứ tự đặt lại mỗi ngày kinh doanh" | Có |
| (không có) | Các cờ rủi ro: `credit`, `quick_credit` (lồng dưới `credit`), `returns`, `refunds`, `exchanges`, `cash_moves`, `edit_lease`, `traceability`, `exports` | Có |

### 3. Thiết lập khi bán hàng (hiển thị trên màn bán), toàn bộ là **Mới**

| Tham khảo | Parkviet `sales_settings` | Mặc định |
|---|---|---|
| Hiển thị tồn kho trên giỏ hàng | `show_stock` | `true` (giữ hành vi hiện tại) |
| Xem giá vốn khi bán hàng | `show_cost`. Chỉ hiện cho nhân viên có capability mới `pos.cost.view` tại chi nhánh | `false` |
| Sắp xếp sản phẩm trong giỏ | `cart_order`: `newest_first` \| `oldest_first` | `oldest_first` (giữ hành vi hiện tại) |
| Hiển thị tất cả phân loại khi bán | Không làm: danh mục đã có bộ chọn SKU/đơn vị theo từng module | Không |

### 4. Tiện ích bán hàng

| Tham khảo | Parkviet | Trạng thái |
|---|---|---|
| Quét mã vạch | Luôn bật, phụ thuộc phần cứng. Phần hiệu chỉnh máy quét vẫn ở POS | Không |
| In hoá đơn (xem trước) | Hộp thoại in hoá đơn đã có | Không cần cờ |
| In tạm tính | Có khi bật `fnb.postpay` / `fnb.tables`. Hiện dòng chỉ đọc kèm liên kết | Có |
| Hẹn giao sau / phí giao hàng | Cờ `delivery` (đã gồm người giao và phí giao) | Có |
| Thêm ghi chú cho đơn | `order_note`: ẩn ô ghi chú trên màn bán khi tắt. Ghi chú đã có vẫn in | **Mới**, mặc định `true` |
| Thêm khuyến mãi cho đơn | `coupons`: ẩn ô nhập mã giảm giá. Server từ chối 409 `feature_disabled` khi tắt | **Mới**, mặc định `true` |
| Thêm phụ thu cho đơn | `fnb.service_charge`, nút "Thiết lập" mở Sơ đồ bàn | Có + Chuyển |
| VietQR, màn hình khách | Cờ `vietqr`, `customer_display` | Có |
| Chuông báo tiền về | `payment_chime`: `off` \| `default`. Phát khi VietQR hoặc chuyển khoản báo thành công, dùng chung cơ chế âm thanh với `scan-sounds.ts` | **Mới**, mặc định `default` |

### 5. Tự động in

| Tham khảo | Parkviet | Trạng thái |
|---|---|---|
| Tự in bếp khi tạo / cập nhật đơn | `kitchen_send_trigger` (`on_complete` \| `manual`), chuyển ra đây thành ô chọn. Tab Bếp & bar chỉ giữ trạm bếp và lý do huỷ | Chuyển |
| Tự in hoá đơn khi thanh toán | `auto_print_receipt`: giá trị mặc định của chi nhánh. Cài đặt trên từng máy vẫn thắng nếu thu ngân đã chọn trên máy đó | **Mới**, mặc định `false` |
| Tự in hoá đơn khi tạo đơn chưa thanh toán | Phiếu tạm tính đã phục vụ việc này | Không |
| Tự in tem món khi lưu đơn | Kiểm tra `cup_label_settings`. Nếu đã có khoá tự in thì đưa ra đây, chưa có thì thêm `auto_print` vào `cup_label_settings` | Kiểm tra / Mới |

### 6. Xử lý đơn hàng

| Tham khảo | Parkviet | Trạng thái |
|---|---|---|
| Thanh toán trước | Mặc định của POS bán lẻ | Có (mô tả) |
| Giao đơn / Lưu đơn (chưa tính doanh thu) | `fnb.postpay` (mở bàn, trả sau) và đơn tạm giữ (`parked`) | Có |
| Bán nhanh / Thanh toán | Luồng mặc định, không tắt được | Có (mô tả) |
| Chờ xác nhận | `qr_order_mode` (`staff_approval` / tự nhận), chuyển ra đây khi bật `fnb.qr_order`. `kiosk_kitchen_before_payment` khi bật `fnb.kiosk` | Chuyển |

## Thiết kế

### Dữ liệu: `sales_settings` trên chi nhánh

- Migration thêm `spree_pos_branches.sales_settings jsonb default {} not null` và ràng buộc `jsonb_typeof = 'object'`.
- `Spree::Pos::SalesSettings` (PORO) khai báo từng khoá: kiểu, giá trị cho phép, mặc định. Khoá lạ bị từ chối với 422. Thiếu khoá thì dùng mặc định, nên dữ liệu cũ không cần backfill.
- Khoá: `allow_oversell`, `warn_below_cost`, `show_stock`, `show_cost`, `cart_order`, `order_note`, `coupons`, `payment_chime`, `auto_print_receipt`.
- Ghi: `PUT /pos/branches/:id/sales_settings` nhận một phần các khoá và gộp vào giá trị đang có. Quyền giống `BranchModules::Set`: `write_pos_topology`, hoặc `pos.topology.manage` tại chi nhánh đó. **Không cần lý do** (đây là cài đặt hiển thị và tiện ích, không đụng tiền hay hàng). Audit `branch_sales_settings.change` ghi `{key: [from, to]}`. Lần gọi không đổi gì thì không ghi.
- Đọc: `context` trả `sales_settings` đã điền mặc định cho chi nhánh đang chọn. Offline snapshot (`OfflineSales::Snapshot`) chép lại giá trị này. Serializer của chi nhánh cũng trả nó cho dashboard.
- `coupons = false`: `workspaces/apply_coupon.rb` trả 409 `feature_disabled`, giống cách các cờ rủi ro đang làm. Các khoá còn lại chỉ ảnh hưởng UI, server không kiểm tra.
- `show_cost`: `CatalogReader` chỉ trả `cost_price` khi khoá này bật **và** nhân viên có `pos.cost.view` tại chi nhánh. Không gửi giá vốn xuống máy rồi mới ẩn trên giao diện. Offline snapshot cũng chỉ chép `cost_price` theo cùng điều kiện.

### Capability `pos.cost.view`

- Thêm `COST_VIEW = 'pos.cost.view'` vào `Spree::Pos::Capabilities`, kèm danh sách capability hợp lệ, nhóm quyền mặc định (không gán cho thu ngân; gán cho vai trò quản lý nếu seed có sẵn) và nhóm hiển thị `reports` trong trình sửa nhóm quyền của dashboard.
- Thêm vào danh sách capability trong `packages/pos-shared` và chuỗi `capability_pos.cost.view` / gợi ý ở cả `vi.json` và `en.json` của dashboard và POS.
- Không ảnh hưởng báo cáo lãi gộp: báo cáo vẫn theo quyền báo cáo hiện có.

### Chặn bán vượt tồn (`allow_oversell = false`)

- Dịch vụ mới `Spree::Pos::OnHandGuard.ensure!(workspace, variant, base_quantity)` trả 409 `stock_insufficient` với `details: { variant_id, needed, on_hand }`. `needed` là tổng số lượng gốc của variant này trên cả đơn sau khi đổi.
- Chỉ kiểm khi tắt `allow_oversell`, `variant.track_inventory?` đúng và kho chi nhánh có `StockLevel` cho variant (giống quy tắc của `Handover.shelf_shortfall`: kho không giữ số tồn thì không kiểm).
- **Không áp dụng** cho: hàng serial/lô (đã có kiểm riêng); dòng món thực đơn (`SaleLineKinds::Menu`, dùng "hết món" và công thức); đơn từ nền tảng giao hàng (đơn đến từ ngoài, không từ chối được); bán offline (`OfflineSales::Ingest` vẫn nhận, phần thiếu đi vào luồng chênh lệch như hiện nay).
- Gọi ở: `ManageLineItem` khi thêm dòng và khi tăng số lượng (cạnh `sellable_variant!`); bước chốt đơn của workspace (kiểm lại cả đơn, vì ca khác có thể đã bán mất hàng); `GuestOrders::Accept` và `Kiosks::Order` cho dòng không phải món (kiểm khi viết code xem hai luồng này có dòng hàng thường không).
- Không giữ chỗ hàng giữa các đơn đang mở. Hai quầy cùng bán món cuối thì cả hai qua được bước thêm dòng, nhưng đơn chốt sau bị từ chối. Nếu hai lần chốt chạy đồng thời và cùng qua, `Handover` vẫn ghi chênh lệch như hiện nay, nên kệ không bao giờ âm. Plan ghi rõ giới hạn này, không thêm khoá dòng tồn ở bước chốt.
- Bật lại `allow_oversell` không đổi đơn hay chênh lệch đã có.

Lý do dùng cột jsonb thay vì mở rộng `spree_pos_feature_flags`: cờ rủi ro theo mô hình cửa hàng bật, chi nhánh tắt, cần lý do. Các khoá ở đây là tuỳ chọn riêng của từng chi nhánh, có giá trị không phải boolean (`cart_order`, `payment_chime`), và không cần lý do.

### Shared: `packages/pos-shared/src/sales-settings.ts`

Gồm danh sách khoá, giá trị mặc định và `normalizeSalesSettings(value)`: khoá lạ bị bỏ qua, giá trị sai kiểu thì dùng mặc định. Cả dashboard và POS dùng chung, có unit test.

### Dashboard: `pages/branch-features.tsx`

- Bố cục: cột nội dung gồm sáu `ModelCard` theo thứ tự ở trên (`id` = `features-flow`, `features-rules`, `features-display`, `features-utilities`, `features-auto-print`, `features-orders`), cộng mục lục dính bên phải ở `lg+` (component mới `components/section-nav.tsx`, dùng `IntersectionObserver` để tô mục đang xem). Màn hẹp không có mục lục.
- **Một kiểu dòng chung** `components/setting-row.tsx`: tên, mô tả, khu vực điều khiển bên phải (công tắc, ô chọn hoặc nút "Thiết lập"), và khối con lồng tuỳ chọn (thụt lề, viền nhạt). `FeatureSwitchRow` và dòng module chuyển sang dùng nó. Hành vi giữ nguyên: bấm đổi sẽ mở form lý do ngay trong dòng. Nhãn nút và nhãn form giữ nguyên để e2e cũ vẫn khớp.
- Ba loại điều khiển, mỗi loại lưu theo cách riêng:
  1. Module: form lý do, `PUT /modules/:key` (như hiện tại).
  2. Cờ rủi ro: form lý do, `PUT /feature_flags/:feature` (như hiện tại).
  3. `sales_settings` và các cột chuyển ra đây (`kitchen_send_trigger`, `qr_order_mode`, `kiosk_kitchen_before_payment`): đổi ngay, gom các thay đổi lại, có thanh **Lưu / Huỷ** dính ở cuối trang khi có thay đổi chưa lưu, và hỏi trước khi rời trang. Các cột của chi nhánh đi qua `PATCH /pos/branches/:id`, cần quyền quản trị cửa hàng. Thiếu quyền thì dòng chỉ đọc.
- Hook mới `hooks/use-sales-settings.ts`, query key `['pos', storeId, 'branch-sales-settings', branchId]`. Sau khi lưu thì invalidate key đó và `context`.
- Dòng nào không áp dụng cho chi nhánh (module tắt hoặc không có trong ngành) thì **ẩn**, không hiện mờ. Riêng module con có module cha đang tắt thì hiện mờ, để người dùng biết bật ở đâu.
- Tab Bếp & bar bỏ ô "Gửi bếp", tab Sơ đồ bàn bỏ ô chế độ QR. Cả hai thay bằng dòng "Cấu hình ở tab Chức năng" kèm liên kết, để không có hai nơi cùng sửa một giá trị.
- Tổng quan giữ nguyên (thông tin chi nhánh + ngành hiện tại).

### POS bán hàng (`apps/pos`)

- Đọc `context.sales_settings` qua `normalizeSalesSettings`.
- `allow_oversell = false`: danh mục hiện nhãn "Hết hàng" và tắt nút thêm khi `stock_on_hand <= 0` (trừ các loại hàng không áp dụng). Lỗi 409 `stock_insufficient` hiện "Chỉ còn {{on_hand}}, đơn cần {{needed}}" ngay ở dòng. Khi offline thì không chặn, vì không có số tồn mới nhất.
- `show_stock`: ẩn dòng tồn trong `catalog-search.tsx`. Nếu `allow_oversell` đang tắt thì vẫn hiện nhãn "Hết hàng".
- `show_cost` (và server có trả `cost_price`): hiện giá vốn nhỏ dưới giá bán.
- `warn_below_cost`: hiện thông báo không chặn khi giá dòng sau giảm thấp hơn `cost_price`. Cần server trả `cost_price` cho riêng mục đích này, kể cả khi `show_cost` tắt. Nếu không muốn lộ giá vốn thì server trả cờ `below_cost` trên từng dòng của workspace. Plan chọn cách thứ hai: thêm `below_cost: boolean` vào serializer dòng.
- `cart_order`: đảo thứ tự hiển thị trong `order-lines.tsx` và `ticket-lines.tsx`, không đổi thứ tự lưu.
- `order_note`, `coupons`: ẩn ô tương ứng trong `payment-panel.tsx`. Ghi chú đã có vẫn hiện và in.
- `payment_chime`: phát âm khi khoản VietQR / chuyển khoản chuyển sang `succeeded`.
- `auto_print_receipt`: `autoPrintEnabled()` chuyển thành "giá trị đã lưu trên máy, nếu chưa có thì lấy mặc định của chi nhánh". `localStorage` chuyển từ chỉ lưu `on` sang lưu cả `on` và `off`. Màn cài đặt máy có thêm "Theo chi nhánh".

## Các bước thực hiện

1. **Shared + server cho `sales_settings`**: `sales-settings.ts` và test. Migration, `SalesSettings`, endpoint `PUT`, audit, trả trong `context`, serializer và offline snapshot. Chặn `coupons` trong `apply_coupon`. Thêm `below_cost` và `cost_price` có điều kiện. Thêm capability `pos.cost.view` (server, shared, trình sửa nhóm quyền, locales).
2. **Chặn bán vượt tồn**: `OnHandGuard` và các chỗ gọi (thêm hoặc tăng dòng, chốt đơn, QR và kiosk nếu có dòng hàng thường), lỗi `stock_insufficient` trong `request-failure` ở shared.
3. **Dashboard, bố cục**: `SettingRow`, `SectionNav`. Chuyển module, cờ rủi ro và mẫu tem cân vào sáu nhóm theo bảng đối chiếu, chưa có khoá mới. Giữ nguyên mọi API. Cập nhật e2e.
4. **Dashboard, khoá mới và cột chuyển ra đây**: dòng `sales_settings` (kể cả `allow_oversell` kèm cảnh báo phạm vi), thanh Lưu/Huỷ, chuyển `kitchen_send_trigger`, `qr_order_mode` và `kiosk_kitchen_before_payment`. Gỡ các ô trùng ở tab Bếp & bar và Sơ đồ bàn. Thêm `pos.cost.view` vào trình sửa nhóm quyền.
5. **POS bán hàng**: áp từng khoá, cả khi offline (nhãn "Hết hàng", lỗi `stock_insufficient`, giá vốn theo quyền).
6. **Kiểm tra hai mục còn mở** (phiếu huỷ món bếp, tự in tem ly) rồi cập nhật bảng đối chiếu.
7. **Tài liệu**: `apps/pos-dashboard/AGENTS.md` (tab Chức năng gồm sáu nhóm, `sales_settings`, `pos.cost.view`), `docs/pos/` nếu có trang hướng dẫn cài đặt chi nhánh, và các chuỗi gợi ý trong locales đang nhắc vị trí cũ.

Có thể làm bước 3 trước bước 1 và 2 vì bước 3 không đổi API.

## Kiểm thử

Chỉ chạy spec liên quan, không chạy cả bộ.

- `pnpm spree rspec spec/models/spree/pos/sales_settings_spec.rb spec/requests/.../branch_sales_settings_spec.rb`: khoá lạ bị 422, nhận một phần khoá, quyền của quản lý chi nhánh và người chỉ đọc, audit chỉ ghi khi có thay đổi, `context` có mặc định.
- `pnpm spree rspec` cho `apply_coupon` (409 khi tắt) và spec của catalog / serializer dòng (`cost_price` chỉ có khi `show_cost` bật và có `pos.cost.view`, `below_cost`).
- `pnpm spree rspec spec/services/spree/pos/on_hand_guard_spec.rb` và spec của `manage_line_item` / chốt đơn. Các trường hợp: bật thì không kiểm; tắt thì từ chối khi thêm vượt tồn và khi tăng số lượng; tổng nhiều dòng cùng variant; hàng không theo dõi tồn, hàng serial/lô, món thực đơn và kho không có `StockLevel` thì bỏ qua; chốt đơn bị từ chối khi đơn khác đã bán mất hàng; offline ingest và đơn nền tảng vẫn được nhận.
- `pnpm --dir packages/pos-shared test` cho `sales-settings.test.ts`.
- Dashboard: tạo mới `e2e/branch-features.spec.ts` (sáu nhóm, mục lục, Lưu/Huỷ, chỉ đọc khi thiếu quyền, tab Bếp & bar và Sơ đồ bàn chỉ còn liên kết), rồi chạy `pnpm --dir apps/pos-dashboard exec playwright test e2e/branch-features.spec.ts e2e/feature-flags.spec.ts e2e/branch-modules.spec.ts e2e/business-model.spec.ts e2e/branch-detail.spec.ts --project desktop`. Thêm `--project tablet --project mobile` cho `branch-features.spec.ts` vì bố cục thay đổi (mục lục ẩn trên màn hẹp, không cuộn ngang).
- POS: `pnpm --dir apps/pos exec playwright test` cho spec của catalog, payment panel và receipt print (ẩn tồn, ẩn ghi chú, ẩn mã giảm giá, thứ tự giỏ, tự in theo chi nhánh và máy ghi đè), `--project desktop`.

## Tiêu chí hoàn thành

- Tab Chức năng có sáu nhóm theo đúng thứ tự, mục lục hoạt động ở `lg+`. Mọi công tắc module và cờ rủi ro hiện có đều còn, vẫn cần lý do và vẫn ghi audit.
- Mỗi giá trị chỉ sửa được ở **một** nơi: `kitchen_send_trigger` và `qr_order_mode` không còn ô sửa ở tab khác.
- Tắt `order_note` / `coupons` / `show_stock` thì màn bán thay đổi ngay sau khi tải lại `context`, kể cả khi offline. Tắt `coupons` thì server từ chối áp mã.
- Nhân viên không có `pos.cost.view` thì không bao giờ nhận `cost_price` qua API hay offline snapshot.
- Tắt `allow_oversell` thì quầy không thêm được hàng vượt tồn và không chốt được đơn vượt tồn (lỗi rõ ràng, còn bao nhiêu và cần bao nhiêu). Mặc định vẫn bán được như hôm nay.
- Máy chưa chọn tự in sẽ theo chi nhánh. Máy đã chọn thì giữ lựa chọn của máy.

## Giới hạn đã biết

- Chặn bán vượt tồn không giữ chỗ hàng giữa các đơn đang mở, và không chặn khi offline. Trong hai trường hợp đó, phần thiếu đi vào luồng chênh lệch tồn khi bàn giao như hiện nay.
- Hai mục cần kiểm khi viết code (phiếu huỷ món bếp, tự in tem ly) có thể làm bảng đối chiếu đổi nhẹ. Bước 6 cập nhật lại bảng.

## Đã làm

Phiếu huỷ món bếp luôn được in (`kitchen/ticket_document.rb`), nên không thêm cờ; mô tả module bếp nói rõ điều đó. Tem món chưa có tự in: thêm `auto_print` (mặc định bật) vào `cup_label_settings`, tắt thì `CupLabels::Issue.after_commit` không xếp job.

Đã chạy: `packages/pos-shared` `sales-settings.test.ts`, `apps/pos` `receipt-preferences.test.ts` và `pos-administration.test.ts`, `pnpm spree rspec` hai spec `sales_settings` và `on_hand_guard` (7 examples). Typecheck dashboard, POS và pos-shared. Chưa chạy Playwright e2e của tab Chức năng.
