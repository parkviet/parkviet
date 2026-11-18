# Menu điện tử (e-Menu) cho gọi món qua QR

Trạng thái: **hoàn tất toàn bộ 5 phần, OpenAPI (`pos-guest.yaml` & `pos-staff.yaml`), SDK `pos-staff` và toàn bộ kiểm thử (RSpec, Vitest, Playwright `table-order` & `pos`)**. (Riêng Playwright của `pos-dashboard` đã viết đủ 4 phần trong `e2e/branch-emenu.spec.ts`; cổng dev `5176` đang mở ở phiên khác nên chưa chạy đè cổng).

Thêm tab **e-Menu** trong trang chi nhánh của POS dashboard. Tab gom mọi cấu hình của trang khách tự gọi món (`apps/table-order`, mở từ tem QR tại bàn). Bố cục và danh sách tùy chọn tham khảo màn "Menu điện tử" và "Thiết lập QR Code" của sản phẩm tham khảo (khảo sát ngoài repo). Tên và nội dung là của Parkviet, không chép nguyên.

## Quyết định đã chốt với người dùng (17/11/2026)

1. **Thực đơn riêng.** e-Menu có danh mục, thứ tự và ảnh riêng. Món được chọn từ các món sẵn có của cửa hàng (`MenuItem`), kể cả món không bán tại quầy. Giá, biến thể và tùy chọn lấy theo món, không có giá riêng cho e-Menu. Thực đơn quầy giữ nguyên.
2. **Thanh toán linh động, cấu hình theo chi nhánh.**
   - *Trả sau* (mặc định, giữ hành vi hiện tại): khách gọi món nhiều lần, ăn xong bấm "Thanh toán". Khách trả tại quầy hoặc chuyển khoản VietQR ngay trên web.
   - *Trả trước*: mỗi lần gọi món là một đơn hàng độc lập gắn tên bàn (không bắt nhân viên mở/đóng bàn thủ công như mô hình quán trà sữa/cà phê trả trước); khách chuyển khoản VietQR trên web hoặc chọn trả tại quầy. Đơn đã trả VietQR tự động hoàn tất (`completed`) và vào bếp ngay, các lần gọi tiếp theo ở cùng bàn tạo đơn mới độc lập không bị khóa bởi lần trước.
3. **Tab trong chi nhánh.** Mỗi chi nhánh cấu hình riêng toàn bộ e-Menu.
4. **Bốn phần:** Giao diện, Thực đơn, Tem QR, Bổ sung.
5. **Thời hạn trả trước có cấu hình**, mặc định 10 phút. Không vượt quá thời hạn mã VietQR sẵn có của phương thức thanh toán (`payment_timeout_minutes`, mặc định 15 phút), vì quá mốc đó mã QR hết hạn.
6. **Món bán chạy có hai cách**: chọn tay, hoặc tự lấy theo doanh số 7 ngày gần nhất.

## Hiện trạng (đã đọc mã)

- Trang khách là `apps/table-order` (Vite + React, phục vụ tại `/table/`). Nó chỉ gọi `/api/v3/pos_guest/*` (`server/openapi/pos-guest.yaml`), qua `Spree::Pos::GuestViewsController`. Trang dùng bảng màu cố định (`styles.css`, `--accent: #0b6e4f`). Chưa có logo hay màu thương hiệu.
- **Thực đơn khách = thực đơn quầy.** `Spree::Pos::GuestMenu` chạy `Menu::Reader` cho chi nhánh, rồi chỉ giữ món có `menu_items.qr_orderable = true`. Kiosk (`channel: :kiosk`) đọc cùng thực đơn nhưng bỏ qua cờ này.
- **Bật/tắt**: module `fnb.qr_order` của chi nhánh cùng feature flag `qr_order` của cửa hàng (`GuestOrders::Guard.enabled?`). Chưa có công tắc "tạm dừng bán".
- **Duyệt đơn**: `branches.qr_order_mode` (chờ duyệt hoặc `direct_to_kitchen` có hạn mức `qr_order_auto_limit` / `qr_order_auto_max_items`). Hai nơi đang ghi cùng cấu hình này: select ở tab Tính năng (`branch-features.tsx` ~543) và `QrOrderSettings` ở tab Sơ đồ bàn (`branch-floor-plan.tsx` 987-1110). Cả hai gọi `PUT /pos/table_settings`.
- **Giới hạn gọi món**: 5 đơn/phút mỗi phiên (rate limit trong controller), tối đa 3 đơn chờ mỗi phiên (`GuestOrder::MAX_PENDING`). Chưa có khoảng cách tối thiểu giữa hai lần gọi.
- **Khách không trả tiền trên web.** "Gọi thanh toán" chỉ tạo `GuestRequest` cho nhân viên. Kiosk đã có luồng VietQR (`Kiosks::State#vietqr?`, `kiosk_kitchen_before_payment`), cùng `PayLater` và `PaymentMethodResolver` tìm tài khoản nhận.
- **Tem QR**: `TableCodes::Issue` in tem với chữ tiếng Việt viết cứng (tên cửa hàng, ghi chú quét mã và Wi-Fi, chú thích "Scan to order"). UI phát hành và in tem ở `components/table-codes-card.tsx`, trên tab Sơ đồ bàn. Không có trường Wi-Fi có cấu trúc.
- **Logo**: `StoreInfo` / `BranchInfo` đã có `has_one_attached :logo`, và chi nhánh kế thừa từ cửa hàng.
- **Khuyến mãi**: `Spree::Pos::TimedPromotion`.
- Tab chi nhánh khai báo ở `BRANCH_TABS` (`apps/pos-dashboard/src/lib/pos-access.ts`), mỗi tab có một route file trong `routes/_authenticated/$storeId/branches/$branchId/`.
- **Đang có việc dở của phiên khác** (cấu hình đặt bàn) sửa `table_settings_controller.rb`, `tables/settings.rb`, `branch-floor-plan.tsx`, `use-floor-plan.ts`. Plan này không sửa hai file server đó. Hai file dashboard chỉ được sửa sau khi phần đặt bàn đã commit.

## Đối chiếu với sản phẩm tham khảo

| Sản phẩm tham khảo | Parkviet |
|---|---|
| Màu thương hiệu, màu chữ chính, màu nút | Mới: `emenu_settings.brand_color`, `text_color`, `button_color`. Có bảng màu gợi ý và ô chọn tự do. |
| Logo cửa hàng (≤2MB, 512×512) | Dùng logo của `BranchInfo` (kế thừa cửa hàng). Tab e-Menu cho đổi logo ngay tại chỗ, qua API branch info sẵn có. |
| Banner khuyến mãi (bật/tắt, chọn khuyến mãi) | Mới: `banner_enabled`, `banner_promotion_ids` trỏ tới `TimedPromotion`. Chỉ hiện khuyến mãi đang chạy. |
| Món bán chạy, Món mới (bật/tắt + danh sách) | Mới: `best_sellers_enabled`, `best_sellers_source` (chọn tay hoặc tự theo doanh số 7 ngày), `best_seller_item_ids`; `new_items_enabled` / `new_item_ids`. |
| Danh mục hiển thị | Thay bằng **thực đơn riêng**: danh mục e-Menu và món trong từng danh mục. |
| Thời gian tối thiểu giữa các lần gọi (giây) | Mới: `min_order_interval_seconds`, mặc định 0, gợi ý 60. Server chặn. |
| Tạm dừng bán hàng | Mới: `paused`. Khách mở QR thấy thông báo tạm ngừng, không xem thực đơn, không gọi món. |
| Tem QR: logo, tên, Wi-Fi, lời chào ≤100 ký tự, khu vực–bàn, cỡ 60/80/100/tùy chọn | Mới: `sticker_*`. `TableCodes::Issue` đọc các trường này thay cho chữ viết cứng. |
| (không có) | Gom về đây: chế độ duyệt đơn và hạn mức tự vào bếp, cùng **cách thanh toán** (trả trước/trả sau). |

## 1. Dữ liệu và API cấu hình (server)

**Migration**

- `spree_pos_branches.emenu_settings` jsonb, mặc định `{}`. Đọc qua service `Spree::Pos::EmenuSettings`, viết theo mẫu `SalesSettings`: khóa thiếu thì đọc giá trị mặc định, khóa lạ hoặc sai kiểu trả 422.
  - Giao diện: `brand_color`, `text_color`, `button_color` (`#RRGGBB`, mặc định là bảng màu hiện tại của trang khách).
  - Thực đơn: `banner_enabled`, `banner_promotion_ids[]`, `best_sellers_enabled`, `best_sellers_source` (`manual` | `auto`, mặc định `manual`), `best_seller_item_ids[]` (dùng khi `manual`), `best_sellers_limit` (1–20, mặc định 8, dùng khi `auto`), `new_items_enabled`, `new_item_ids[]` (tối đa 20 mỗi danh sách, phải là món có trong e-Menu).
  - Bổ sung: `min_order_interval_seconds` (0–3600), `paused` (bool), `payment_timing` (`pay_after` | `pay_before`, mặc định `pay_after`), `pay_methods` (tập con của `vietqr`, `counter`, ít nhất một, mặc định cả hai), `prepay_timeout_minutes` (1–60, mặc định 10).
  - Tem QR: `sticker_show_logo`, `sticker_show_name`, `sticker_store_name` (rỗng thì lấy tên kế thừa), `sticker_wifi_enabled`, `sticker_wifi_name`, `sticker_wifi_password`, `sticker_greeting` (≤100, mặc định "Quét mã để gọi món/gọi nhân viên"), `sticker_size` (`60`, `80`, `100` hoặc `custom` cùng `sticker_custom_mm` 40–200).
- Bảng `spree_pos_emenu_categories` (`branch_id`, `name`, `position`, `color`, `image`) và `spree_pos_emenu_items` (`emenu_category_id`, `menu_item_id`, `position`). Unique `(emenu_category_id, menu_item_id)`. Món của cửa hàng khác bị từ chối.

**API cho dashboard** (`server/openapi/pos-staff.yaml`, có audit `emenu.update` giống `table_settings.update`, cần `Idempotency-Key`):

- `GET/PUT /api/v3/admin/pos/emenu_settings?branch_id=` đọc và ghi `emenu_settings` theo kiểu patch từng phần.
- `GET /api/v3/admin/pos/emenu_menu?branch_id=` và `PUT` cùng đường dẫn: thay cả cây danh mục và món trong một lần ghi (transaction), để màn kéo-thả gửi một lần.
- Chế độ duyệt đơn và hạn mức vẫn ghi qua `PUT /pos/table_settings` sẵn có. Không thêm nơi ghi thứ ba.
- Quyền: dùng capability đang gác tab Tính năng/Sơ đồ bàn (xác nhận khi làm). Thêm trang `branch-emenu` vào `pos-access`.

**Spec**: request spec cho hai endpoint (đọc mặc định, patch, 422 khóa lạ, món khác cửa hàng, audit), cùng unit spec cho `EmenuSettings`.

## 2. Phía khách trên server

- `GuestMenu.call(branch, channel: :qr)`: khi chi nhánh **đã có ít nhất một danh mục e-Menu** thì dựng thực đơn từ bảng e-Menu. Giá, biến thể, tùy chọn và cờ hết món lấy qua `Menu::Pricing` / dữ liệu món như hiện nay, kể cả món bị ẩn ở quầy. Khi chưa có danh mục e-Menu nào thì giữ nguyên đường cũ (thực đơn quầy lọc `qr_orderable`), để chi nhánh đang dùng không bị gãy. Kiosk không đổi.
  - Cần xác minh khi làm: `Menu::Reader` bỏ món ẩn ở quầy (`menu_item_hidden`). Đường e-Menu phải đọc giá và hết món của những món này mà không làm đổi kết quả của quầy.
  - `GuestMenu.variants` (dùng khi nộp và duyệt đơn) phải theo cùng nguồn, để món chỉ có trên e-Menu vẫn duyệt được.
- **Món bán chạy tự động** (`best_sellers_source = auto`): service `Emenu::BestSellers` cộng số lượng bán của từng món e-Menu trong 7 ngày kinh doanh gần nhất của chi nhánh (đơn đã hoàn tất, trừ hoàn trả), lấy `best_sellers_limit` món cao nhất, bỏ món hết hàng. Kết quả cache theo chi nhánh trong 1 giờ. Chưa có doanh số thì phần này ẩn.
- Phản hồi `GET /pos_guest/menu` thêm `theme` (ba màu, `logo_url`), `sections` (`banner` gồm các khuyến mãi đang chạy, `best_sellers`, `new_items` dạng danh sách id) và `payment` (`timing`, `methods`, `vietqr_available`). Phiên khách (`/pos_guest/session`) trả thêm `paused`.
- `paused = true` làm `authenticate_guest!` trả lỗi `emenu_paused` (409) cho thực đơn và gọi món. Mở phiên vẫn được, để trang hiện thông báo.
- `min_order_interval_seconds`: `GuestOrders::Guard` từ chối đơn mới của cùng **bàn** nếu đơn gần nhất mới cách chưa đủ số giây. Trả `order_too_soon` (429) kèm `retry_after_seconds`.
- **Trả trước** (`pay_before`):
  - Khách chọn VietQR: đơn được tạo ở trạng thái mới `awaiting_payment`, kèm một yêu cầu thanh toán VietQR (dùng lại `PaymentRequest` / luồng QR của kiosk). Khi webhook ngân hàng báo đã nhận, đơn được duyệt tự động (`Accept` dưới tên hệ thống) và vào bếp, khoản tiền được ghi vào đơn của bàn. Nếu quá hạn chưa trả thì đơn tự hủy, không đụng tới đơn của bàn. Hạn trả = `min(prepay_timeout_minutes, payment_timeout_minutes của phương thức VietQR)`. Mã QR hiện cho khách và job hủy đơn dùng cùng mốc này.
  - Khách chọn trả tại quầy: đơn chờ nhân viên như hiện nay. Nhân viên thu tiền rồi duyệt.
- **Trả sau** (`pay_after`): giữ luồng hiện tại. Thêm `POST /pos_guest/bill_payment`: khi `vietqr` có trong `pay_methods` và bàn có đơn đang mở, server trả VietQR cho số còn phải trả của đơn bàn (dùng `PayLater`-kiểu nội dung chuyển khoản riêng cho bàn). Khi webhook khớp, tiền được ghi vào đơn và nhân viên thấy bàn đã trả. Chọn trả tại quầy vẫn tạo `GuestRequest request_bill`.
- `TableCodes::Issue`: tem đọc `sticker_*` (logo, tên, Wi-Fi, lời chào, cỡ tem). Bỏ chữ viết cứng.
- Cập nhật `server/openapi/pos-guest.yaml`. Request spec cho: thực đơn e-Menu và đường cũ, tạm dừng, khoảng cách gọi món, trả trước bằng VietQR (đã trả / quá hạn), trả sau qua VietQR, tem QR.

## 3. Tab e-Menu trên POS dashboard

- Thêm `{ key: 'emenu', page: 'branch-emenu', path: '/emenu' }` vào `BRANCH_TABS`. Tab chỉ hiện khi chi nhánh bật `fnb.qr_order`. Thêm route `routes/_authenticated/$storeId/branches/$branchId/emenu.tsx`, trang `pages/branch-emenu.tsx`, hook `hooks/use-emenu.ts`.
- Bố cục hai cột: các phần cấu hình bên trái (dùng `section-nav`, có Hủy bỏ / Lưu thiết lập như các trang cài đặt hiện có), **bản xem trước điện thoại** dính bên phải. Bản xem trước đổi theo màu, logo, banner, món bán chạy, món mới và danh mục, ngay khi sửa chưa lưu. Ở phần Tem QR, bản xem trước chuyển sang hình tem.
- **Giao diện**: ba màu (bảng gợi ý cùng ô chọn tự do), logo (tải lên qua branch info, PNG/JPG ≤2MB).
- **Thực đơn**: trình dựng danh mục e-Menu (thêm, đổi tên, màu, kéo-thả thứ tự) và món trong từng danh mục (hộp chọn tìm trong tất cả món của cửa hàng, đánh dấu món không bán tại quầy). Thêm hai danh sách Món bán chạy (bật/tắt, chọn "Chọn tay" với "Sửa danh sách" hoặc "Tự động theo doanh số 7 ngày" với số món hiển thị; bản xem trước hiện danh sách tự tính hiện tại) và Món mới (bật/tắt + "Sửa danh sách"), cùng Banner khuyến mãi (bật/tắt, lọc Tất cả/Đang chạy/Sắp diễn ra/Kết thúc, chọn khuyến mãi, liên kết sang trang khuyến mãi). Nút "Lấy từ thực đơn quầy" chép danh mục và món đang bật QR làm điểm khởi đầu.
- **Tem QR**: hiện logo, tên cửa hàng, Wi-Fi (tên, mật khẩu), lời chào có đếm ký tự, cỡ tem. Có liên kết sang tab Sơ đồ bàn để phát hành và in mã. `TableCodesCard` giữ nguyên chỗ.
- **Bổ sung**: khoảng cách tối thiểu giữa các lần gọi, tạm dừng bán hàng, cách thanh toán (trả sau/trả trước, VietQR/trả tại quầy; cảnh báo nếu chi nhánh chưa có tài khoản VietQR), thời hạn trả trước (phút, mặc định 10, có ghi chú thời hạn mã VietQR hiện tại và cảnh báo khi số nhập lớn hơn), chế độ duyệt đơn và hạn mức tự vào bếp. Phần duyệt đơn được **chuyển** từ `QrOrderSettings` (tab Sơ đồ bàn) và select ở tab Tính năng sang đây. Hai nơi cũ đổi thành dòng liên kết tới tab e-Menu.
- i18n `vi.json` / `en.json`. Playwright `e2e/branch-emenu.spec.ts` (desktop): lưu từng phần, dựng thực đơn, xem trước đổi màu.

## 4. Trang khách `apps/table-order`

Giữ ràng buộc của app: bundle nhỏ, không router, không thư viện query, không import từ `apps/pos` hay `packages/pos-shared`.

- **Theme**: áp `theme` vào biến CSS (`--accent`, màu chữ, màu nút) khi tải thực đơn. Hiện logo và tên ở đầu trang.
- **Trang chủ thực đơn**: banner khuyến mãi, "Món bán chạy" (có "Xem tất cả"), "Món mới", rồi "Khám phá danh mục". Ô tìm món.
- **Tạm dừng**: màn thông báo khi `paused` hoặc khi gặp lỗi `emenu_paused`.
- **Khoảng cách gọi món**: khi gặp `order_too_soon`, nút Gửi hiện đếm ngược `retry_after_seconds`.
- **Trả trước**: ở giỏ hàng, chọn VietQR hoặc trả tại quầy. Với VietQR thì hiện mã QR (render tại chỗ bằng `uqr`, đã dùng ở dashboard), số tiền, nội dung chuyển khoản, rồi hỏi lại trạng thái đến khi đã trả, quá hạn hoặc hủy.
- **Trả sau**: ở "Bàn của tôi", nút "Thanh toán" mở lựa chọn VietQR (hiện QR số còn phải trả) hoặc gọi nhân viên tính tiền.
- Unit test cho theme, phân đoạn trang chủ, đếm ngược. Playwright `test:e2e` với API giả cho: tạm dừng, trả trước VietQR, trả sau VietQR.

## 5. Màn nhân viên `apps/pos`

- Đơn khách `awaiting_payment` không hiện trong hàng chờ duyệt. Đơn đã trả trước hiện nhãn "Đã thanh toán", và được duyệt tự động.
- Bàn có khoản VietQR khách tự trả hiện số đã trả trên đơn, như một lần thanh toán bình thường.
- Cập nhật `use-guest-orders.ts`, `lib/guest-orders.ts`, cùng e2e liên quan.

## Thứ tự và phụ thuộc

1 → 2 → (3 song song 4) → 5. Phần 3 sửa `branch-floor-plan.tsx` và `use-floor-plan.ts` sau khi việc đặt bàn của phiên khác đã commit.

## Tiêu chí nghiệm thu

- Chi nhánh bật `fnb.qr_order` có tab e-Menu với bốn phần. Lưu xong, tải lại vẫn đúng. Xem trước đổi theo lúc sửa.
- Có danh mục e-Menu thì khách chỉ thấy thực đơn e-Menu, kể cả món không bán tại quầy, và gọi được những món đó. Chưa có thì khách thấy thực đơn cũ. Thực đơn quầy và kiosk không đổi.
- Tạm dừng thì khách không xem được thực đơn, không gọi được món.
- Gọi món sớm hơn khoảng cách tối thiểu thì bị chặn ở server, và trang khách đếm ngược.
- Trả sau: gọi nhiều lần, rồi trả bằng VietQR hoặc gọi nhân viên. Trả trước: đơn VietQR chỉ vào bếp khi tiền đã về, quá hạn thì tự hủy.
- Món bán chạy hiện đúng danh sách chọn tay, hoặc đúng thứ tự doanh số 7 ngày khi chọn tự động.
- Đơn trả trước chưa thanh toán tự hủy đúng thời hạn đã cấu hình (mặc định 10 phút).
- Tem in ra theo cấu hình tem QR.
- Chế độ duyệt đơn chỉ còn một nơi sửa.
- Spec của các file đã đổi đều qua (rspec theo file, Playwright desktop theo file, `pnpm test`/`typecheck`/`lint` trong `apps/table-order` và `apps/pos-dashboard`).

## Rủi ro

- **Ghi nhận tiền VietQR từ khách ẩn danh** là phần rủi ro nhất: khớp webhook với đúng đơn, xử lý chuyển thiếu/thừa, và trả trước khi đơn bị hủy do quá hạn. Phải dùng lại đường webhook và `ReceiveTransfer` sẵn có, không tạo đường thu tiền mới.
- Món chỉ có trên e-Menu đi qua `Accept` → `Workspaces::AppendItems`, nên phải kiểm tra đường thêm món của quầy không chặn món ẩn ở quầy.
- Rate limit dùng `Rails.cache` theo tiến trình. Kiểm khoảng cách gọi món phải dựa vào DB (thời điểm đơn gần nhất của bàn), không dựa vào cache.
- Mật khẩu Wi-Fi in trên tem là thông tin công khai tại quán. Chỉ trả trong API dashboard và tem, không trả trong API khách.

## Câu hỏi còn mở

Không còn.
