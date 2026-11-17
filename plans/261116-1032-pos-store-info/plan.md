# Thông tin cửa hàng POS, chi nhánh thừa kế

Trạng thái: bản nháp chờ duyệt. Chưa viết code.

## Quyết định đã chốt

1. **Loại hình kinh doanh chọn nhiều.** Module bật = **hợp** module của mọi loại hình đã chọn. Loại hình **đầu tiên là loại hình chính**: lấy mặc định chi nhánh (`branch_defaults`) và hiển thị chính.
2. **Giờ mở cửa và giờ chốt ngày là hai trường riêng**, đặt cạnh nhau. Giờ chốt ngày (`business_day_cutoff`) được **gợi ý theo giờ đóng cửa** (vd. 14:00 → 05:00 thì gợi ý 05:00), người dùng sửa được. Chi nhánh thừa kế cả hai.
3. **Địa chỉ có cấu trúc**: chọn Tỉnh/Thành → Phường/Xã theo danh mục hành chính 2 cấp mới (34 tỉnh, từ 01/07/2025), đóng gói sẵn trong repo, cộng ô số nhà/đường.
4. Thông tin thương mại điện tử của `Spree::Store` (dashboard Spree) **giữ nguyên**, không sửa. POS có bản thông tin riêng.
5. **Logo POS độc lập với logo Spree.** Chưa đặt logo POS thì hiện logo `Spree::Store` làm ảnh mặc định; đặt hoặc xoá logo POS không đụng logo Spree. Logo hiệu lực dùng cho POS bán hàng, trang QR, hoá đơn.
6. **Gộp trang "Mô hình kinh doanh" của cửa hàng vào trang Thông tin cửa hàng**; `/settings/business-model` chuyển hướng sang `/settings/store-info`. Loại hình chọn nhiều **ngay ở bước thiết lập ban đầu** (setup wizard), và khi sửa sau đó thì chọn kiểu tag (chip có dấu ×, ô xổ xuống).

## Hiện trạng (đã đọc mã)

- Loại hình: `StoreProfile.profile_key` (một khoá) và `Branch.profile_key` (một khoá). Khoá quyết định module qua `config/pos/business_profiles.yml` (`modules`, `optional_modules`, `branch_defaults`, `sample_units`, `kitchen_stations`). Đổi loại hình chi nhánh đi qua `Profiles::Preview` → `Profiles::Apply` (xem trước, chọn mặc định, khoá chi nhánh, audit).
- Ngày kinh doanh: `Branch.business_day_cutoff` (mặc định 04:00) + `BusinessDay.for` gán `business_date` cho ca và đơn. Không có giờ mở cửa, không có giờ chốt cấp cửa hàng.
- Thông tin in: hoá đơn (`ReceiptBuilder.store_profile`, `STORE_PROFILE_FIELDS`), trang QR khách, tem ly, offline snapshot và `context` đều đọc `Spree::Store` (name, address, contact_phone, customer_support_email, logo).
- Mã số thuế chỉ có trong cài đặt hoá đơn điện tử (`EinvoiceSetting.seller_tax_code`, `TAX_CODE`).
- Không có dữ liệu địa chính Việt Nam trong repo.

## Thiết kế dữ liệu

### Bảng mới `spree_pos_store_infos` (một dòng mỗi cửa hàng) và `spree_pos_branch_infos` (một dòng mỗi chi nhánh)

Cùng một bộ cột; ở chi nhánh mọi cột **nullable**, `NULL` = thừa kế cửa hàng.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `name` | string(120) | Bắt buộc ở cửa hàng |
| `phone` | string(15) | Bắt buộc ở cửa hàng; chuẩn hoá số VN (0xxxxxxxxx / +84) |
| `admin_email` | string | Email Parkviet liên hệ chủ quán |
| `contact_email` | string | Email khách liên hệ, in lên hoá đơn |
| `tax_code` | string(14) | Dùng `EinvoiceSetting::TAX_CODE` |
| `representative_id_number` | string(12) | CCCD 12 chữ số; chỉ người có quyền ghi topology xem được |
| `opening_time`, `closing_time` | time | Đóng < mở nghĩa là qua đêm |
| `province_code`, `ward_code` | string | Mã theo danh mục 2 cấp |
| `street` | string(200) | Số nhà, đường, toà nhà |
| `description` | text(1000) | |
| logo | Active Storage | ≤ 2 MB, PNG/JPG/SVG/ICO |

Giờ chốt ngày ở cửa hàng: thêm `business_day_cutoff` (time, mặc định 04:00) vào `spree_pos_store_infos`. `Branch.business_day_cutoff` đổi thành nullable: `NULL` = thừa kế; `BusinessDay.for` đọc giá trị hiệu lực. Migration giữ nguyên giá trị đang có của từng chi nhánh (không đổi ngày kinh doanh của dữ liệu cũ).

Lý do bảng riêng thay vì thêm cột vào `StoreProfile`/`Branch`: thông tin liên hệ không liên quan đến module, và `Branch` đã rất nhiều cột; đọc "giá trị hiệu lực" gom vào một chỗ.

### Loại hình nhiều

- `spree_pos_store_profiles.profile_keys` (jsonb array, ≥ 1, không trùng); `profile_key` giữ lại = phần tử đầu (tương thích mã đang đọc).
- `spree_pos_branches.profile_keys` tương tự (chi nhánh luôn có danh sách riêng vì nó quyết định module; tạo chi nhánh thì chép từ cửa hàng).
- Migration backfill `profile_keys = [profile_key]`.
- `BusinessProfiles.combine(keys)` trả một "hồ sơ gộp": `modules` và `optional_modules` = hợp (trừ phần đã bắt buộc), `sample_units` và `kitchen_stations` = hợp có thứ tự, `branch_defaults` = của loại hình chính, câu hỏi bàn (`tables`) gộp theo hợp. Mọi chỗ đang gọi `profile.modules_for` chuyển sang hồ sơ gộp: `Onboarding::Setup`, `Branches::Create`, `Profiles::Preview`, `Profiles::Apply`, `Profiles::UpdateStore`.
- `Profiles::Preview/Apply` nhận `profile_keys` + `expected_profile_keys` (409 `profile_conflict` khi danh sách đã đổi). Vẫn giữ nhận `profile_key` một khoá để không gãy client cũ.

### Giá trị hiệu lực

`Spree::Pos::StoreInfo.effective(branch)` trả từng trường: giá trị chi nhánh nếu có, không thì cửa hàng, không thì `Spree::Store` (name, address, contact_phone, customer_support_email, logo) để cửa hàng chưa điền vẫn in như hôm nay. Kèm `source` từng trường (`branch` / `store` / `ecommerce`) cho màn hình.

Chỗ đổi sang đọc giá trị hiệu lực: `ReceiptBuilder` (store name/phone/address/email/tax code), `PrintDocuments::TemplateData`, `guest_views_controller`, `TableCodes::Issue`, `CupLabels::Document`, `OfflineSales::Snapshot`, `context_controller` (name, logo). Hoá đơn điện tử giữ `seller_*` riêng nhưng mặc định lấy tên và MST hiệu lực khi để trống.

### Danh mục địa chỉ

- File `server/config/pos/vn_admin_units.json` (mã tỉnh, tên tỉnh, danh sách phường/xã: mã, tên, loại). Nguồn: danh mục của Tổng cục Thống kê theo Nghị quyết 202/2025/QH15; ghi nguồn và ngày lấy trong file.
- `GET /api/v3/admin/pos/admin_units` (cache dài, ETag) và `?province=xx` trả phường/xã. Máy chủ kiểm `ward_code` thuộc `province_code`.
- Chuỗi hiển thị: `"{street}, {ward}, {province}, Việt Nam"`, dùng cho hoá đơn.

## API

- `GET/PATCH /api/v3/admin/pos/store_info`: đọc/ghi thông tin cửa hàng + `profile_keys` + `business_day_cutoff`. Quyền `write_pos_topology`. Đổi `profile_keys` ở cửa hàng chỉ là mặc định cho chi nhánh mới (giống `UpdateStore` hôm nay), không đụng chi nhánh đang chạy.
- `GET/PATCH /api/v3/admin/pos/branches/:id/info`: trường override (gửi `null` để về thừa kế) + bản hiệu lực có `source`. Quyền ghi chi nhánh.
- `POST/DELETE .../store_info/logo`, `.../branches/:id/info/logo`.
- Mỗi lần ghi: một workflow (`StoreInfos::Save`, `BranchInfos::Save`), khoá dòng, audit `store_info.change` / `branch_info.change` (trường đổi, trước/sau; CCCD ghi che `********1234`), lỗi 422 theo trường để `mapSpreeErrorsToForm` dùng được.
- Bổ sung `context`: `store.info` (bản hiệu lực của chi nhánh đang chọn) để POS bán hàng in đúng.

## Giao diện (apps/pos-dashboard)

**Trang cửa hàng** `/settings/store-info` (mục đầu trong `settings` của `nav.ts`, khoá `store-info` trong `pos-access.ts`):
- Đầu trang: tiêu đề "Thông tin cửa hàng", mô tả, nhãn "x/11 mục đã điền" (logo, tên, SĐT, 2 email, MST, CCCD, loại hình, giờ mở cửa, địa chỉ, mô tả).
- Thẻ "Thông tin chung & liên hệ": logo (ô ảnh hiện logo Spree làm mặc định khi chưa có logo POS, nút "Chọn ảnh", nút "Dùng logo mặc định" khi đã đặt), tên*, SĐT*, email quản trị, email liên hệ, MST, CCCD, loại hình (ô chọn kiểu tag: chip có ×, danh sách xổ xuống; chip đầu là loại hình chính, có "Đặt làm chính"), giờ mở cửa (khoảng giờ, cho qua đêm). Phần "Bán sỉ" và "Quan tâm (sắp có)" của trang Mô hình kinh doanh cũ chuyển vào thẻ này.
- Ngay dưới giờ mở cửa: "Giờ chốt ngày kinh doanh" kèm giải thích ("Bán sau 00:00 đến trước giờ chốt tính cho ngày hôm trước"), nút "Dùng giờ đóng cửa" khi khác gợi ý.
- Thẻ "Thông tin khác": địa chỉ (ô hiển thị + nút "Chọn" mở hộp chọn Tỉnh → Phường/Xã → số nhà), mô tả.
- Thanh dưới dính: "Hoàn tác" / "Lưu thay đổi" (tắt khi không đổi).
- Khi đổi loại hình: hiện trước danh sách module sẽ là mặc định cho chi nhánh mới; ghi chú "Chi nhánh đang chạy không đổi; đổi ở tab Thông tin của từng chi nhánh".

**Tab chi nhánh** `/branches/$branchId` (tab `overview` đổi tên "Thông tin"):
- Cùng biểu mẫu; mỗi trường hiện giá trị hiệu lực, nhãn "Theo cửa hàng" khi thừa kế, nút "Tuỳ chỉnh" để override và "Dùng của cửa hàng" để bỏ override.
- Loại hình chi nhánh: multi-select, áp dụng qua luồng xem trước hiện có (`ProfileDiff`) với danh sách khoá; phần bật/tắt module giữ nguyên.
- Các dòng hiện có (mã, múi giờ, kho, ngưỡng...) giữ ở thẻ "Vận hành" trong cùng tab.

Mọi chuỗi có `vi` và `en` (`translation` + `pos`). Bố cục theo `DESIGN.md` (tiêu đề mục có biểu tượng trên thẻ).

## Các giai đoạn

1. **Dữ liệu và danh mục địa chỉ.** Migration hai bảng, `profile_keys`, cutoff nullable + store cutoff (giữ giá trị cũ); model, validation; file danh mục + endpoint `admin_units`. Rspec model + migration backfill.
2. **Loại hình nhiều ở máy chủ.** `BusinessProfiles.combine`; chuyển Onboarding, Branches::Create, Preview, Apply, UpdateStore sang danh sách khoá; giữ tương thích một khoá. Rspec: hợp module, bàn tuỳ chọn, mặc định từ loại hình chính, 409 khi danh sách đổi.
3. **API thông tin + giá trị hiệu lực.** Controller, workflow lưu, logo, audit, quyền; `StoreInfo.effective`; `BusinessDay` đọc cutoff hiệu lực. Rspec request + `business_day` (chi nhánh thừa kế, override, qua đêm).
4. **Nối vào in ấn và context.** Receipt, template data, QR khách, tem ly, offline snapshot, context, e-invoice mặc định. Cập nhật fixtures `spec/fixtures/print_documents/*`; rspec liên quan.
5. **Trang cửa hàng trong pos-dashboard.** Hooks `use-store-info`, schema form, multi-select loại hình, chọn giờ, hộp chọn địa chỉ, logo, bộ đếm, thanh lưu; nav + guard; i18n. Vitest cho gợi ý giờ chốt và bộ đếm (đặt hàm thuần ở `packages/pos-shared`).
6. **Tab Thông tin chi nhánh và setup.** Override/thừa kế từng trường, loại hình nhiều qua `ProfileDiff`. Bỏ `StoreBusinessModelPage` khỏi `business-model.tsx`, route `/settings/business-model` và `/business-model` chuyển hướng sang `/settings/store-info`, gỡ mục `business-model` khỏi `settings` trong `nav.ts`. Setup wizard (`packages/pos-shared/src/setup-wizard.ts`, `components/setup/*`, `Onboarding::Setup`) cho chọn nhiều loại hình, câu hỏi F&B/bàn tính theo hồ sơ gộp; vitest `setup-wizard.test.ts`, rspec `onboarding_spec.rb`.
7. **E2E và tài liệu.** Playwright `store-info.spec.ts` (desktop; thêm tablet/mobile vì có bố cục), sửa `business-model.spec.ts`, `setup.spec.ts`; cập nhật `apps/pos-dashboard/AGENTS.md`.

Phụ thuộc: 1 → 2, 3 → 4; 5 cần 3; 6 cần 2 và 5.

## Rủi ro

- **Hợp module có thể bật module xung đột** (vd. `fnb.order_number` với `fnb.tables` cùng lúc). Cần rà `Modules` xem có cặp loại trừ nhau không; nếu có, chặn tổ hợp đó ở `combine` với 409 rõ lý do.
- `branch_defaults` của các loại hình khác nhau (vd. `lot_selection`): chỉ lấy của loại hình chính; preview phải nói rõ.
- Đổi `business_day_cutoff` sang thừa kế: phải giữ đúng giá trị cũ từng chi nhánh, nếu không báo cáo theo ngày lệch. Spec migration như `backfill_pos_workspace_business_date_spec.rb`.
- Đổi giờ chốt giữa ngày làm ca đang mở có `business_date` khác ca mới: chỉ áp dụng cho ca/đơn tạo sau khi lưu; cảnh báo trên màn hình khi chi nhánh có ca đang mở.
- Hoá đơn in tên/địa chỉ mới: snapshot hoá đơn cũ không đổi (đã chụp lúc in); fixtures in cần cập nhật.
- CCCD là dữ liệu cá nhân: không trả cho quyền đọc thường, che trong audit và log.
- Danh mục địa chỉ có thể còn điều chỉnh: lưu mã + tên tại thời điểm chọn, để địa chỉ cũ vẫn hiển thị khi danh mục đổi.

## Tiêu chí hoàn thành

- Chủ quán sửa được toàn bộ 11 mục ở `/settings/store-info`, bộ đếm đúng, Hoàn tác/Lưu hoạt động.
- Chi nhánh mới thừa kế mọi trường; chi nhánh override được từng trường và trả về thừa kế.
- Chọn nhiều loại hình bật hợp module; chi nhánh cũ không bị đổi module khi cửa hàng đổi loại hình.
- Ngày kinh doanh theo giờ chốt hiệu lực; dữ liệu cũ không lệch ngày.
- Hoá đơn, trang QR, tem ly in thông tin hiệu lực của chi nhánh; cửa hàng chưa điền vẫn in như trước.
- Rspec các file đổi, typecheck, lint, test, build, e2e liên quan đều qua; mọi chuỗi có `vi` và `en`.

## Câu hỏi mở

Không còn. Đã chốt ở quyết định 5 và 6.
