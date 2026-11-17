# Bốn tính năng bổ sung cho tab "Chức năng"

Trạng thái: kế hoạch, chưa làm.

Tiếp nối `plans/261117-0954-pos-chuc-nang-quy-trinh-ban-hang/plan.md`. Bốn mục, làm theo thứ tự dưới đây. Phần còn lại của màn "Quy trình bán hàng" tham khảo không làm thành công tắc riêng.

1. Hiện phân loại ngay trên danh sách bán
2. Hẹn giao sau
3. Tự in phiếu tạm tính khi lưu đơn chưa thanh toán
4. In món đã huỷ

Cả bốn đều là khoá mới trong `sales_settings` của chi nhánh. Giống các khoá đã có, đổi không cần lý do nhưng vẫn ghi audit `branch_sales_settings.change`. Khoá thiếu thì đọc theo mặc định, nên không cần backfill.

| Khoá | Kiểu | Mặc định | Nhóm trên tab Chức năng |
|---|---|---|---|
| `inline_variants` | boolean | `false` | Thiết lập khi bán hàng |
| `scheduled_delivery` | boolean | `false` | Xử lý đơn hàng |
| `auto_print_prebill` | boolean | `false` | Tự động in |
| `print_void_tickets` | boolean | `true` | Tự động in |

Mặc định giữ đúng hành vi hôm nay. Riêng `print_void_tickets = true` là vì phiếu huỷ hiện luôn in.

## Hiện trạng (đã đọc mã)

- **Danh sách bán lẻ** (`apps/pos/src/components/catalog-search.tsx`, server `CatalogReader#search`): mỗi hàng là một variant, tên là `product.name`. Hàng không có tên phân loại (màu, size), nên các variant của cùng một sản phẩm chỉ khác nhau ở SKU. Đơn vị bán (`Spree::Pos::VariantUnit`, một cấu hình cho mỗi variant: `sale_unit`, `base_unit`, tỉ lệ) chỉ được đọc khi mở mục nâng cao (`AddItemForm`, gọi `GET .../variant_units`) cho từng hàng. Thứ tự hàng là `spree_variants.id`, nên các variant cùng sản phẩm không chắc nằm cạnh nhau.
- **Thực đơn quán** (`menu-grid.tsx`): ô món có hơn một variant (size) hoặc có nhóm tuỳ chọn thì phải mở `ModifierSheet` (`addsInOneTap` trong `lib/menu-selection.ts`). `ModifierSheet` đã nhận `initial: { variantId, picks, note }` và có `defaultPicks` theo `default_selected` của từng tuỳ chọn. Nhóm tuỳ chọn có `min_select`, `max_select`, `required`, `allow_quantity`.
- **Giao hàng** (`Spree::Pos::Delivery`, `Deliveries::Assign`, `delivery-form.tsx`): lưu người giao (chữ tự do) và phí giao (một `Spree::Fee` của đơn). Chưa có ngày giờ giao. Đơn giữ `business_date` của ca.
- **Phiếu tạm tính** (`prebill-dialog.tsx`, server `Workspaces::Prebill`): in bằng tay. Với chi nhánh chạy `fnb.postpay`, mỗi lần in được ghi lại: lần đầu miễn phí, lần sau cần quản lý duyệt `workspace.reprint_prebill`. Các chỗ "lưu đơn chưa thanh toán" hiện có: **Treo đơn** (`park`, `workspace-tabs.tsx`) và **Gửi bếp / Gửi và ở lại** (`ticket-footer.tsx`).
- **Phiếu huỷ bếp** (`Kitchen::VoidSent`): luôn tạo `KitchenTicket kind: 'void'` (hiện trên màn bếp) và, nếu trạm có máy in, luôn xếp `PrintJob kind: 'void_ticket'` trong `print!`. `KitchenVoid` và audit ghi trước khi in, độc lập với việc in.

## 1. Hiện phân loại ngay trên danh sách bán (`inline_variants`)

Khi bật, đơn vị quy đổi và thuộc tính hiện sẵn trên từng hàng. Người bán chạm một lần là thêm đúng phân loại, không phải mở SKU rồi mới chọn. Khi tắt thì mọi thứ như hôm nay.

### Bán lẻ: danh sách sản phẩm

Server (`CatalogReader#search`):

- Thêm vào mỗi hàng `options_text` (`variant.options_text`, rỗng với master) và `unit` (`{ sale_unit, base_unit, ratio_numerator, ratio_denominator, dimension, tracked_mode }`), nạp gộp một truy vấn `VariantUnit` cho cả trang. Variant chưa cấu hình thì `unit` là `null` (bán theo cái).
- Thêm tham số `group=product`: sắp theo `spree_products.name, spree_products.id, spree_variants.position, spree_variants.id`, để các variant cùng sản phẩm nằm liền nhau trong trang. Phân trang vẫn tính theo variant. Một sản phẩm bị cắt ở ranh giới trang sẽ hiện ở cả hai trang, chấp nhận được.
- Hai trường mới không lộ gì nhạy cảm, nên trả luôn, không phụ thuộc khoá. Chỉ `group` phụ thuộc khoá (client gửi khi bật).
- Offline snapshot dùng cùng serializer hàng danh mục: thêm hai trường vào snapshot để offline cũng hiện được.

POS (`catalog-search.tsx`):

- Khi bật: gom các hàng liên tiếp cùng `product_id` thành một hàng sản phẩm. Hàng có tên sản phẩm, ảnh và một dải nút phân loại. Mỗi nút ghi `options_text` (hoặc tên đơn vị), giá và tồn nếu `show_stock` bật, ví dụ "Đỏ / M · 120.000", "Thùng (24 lon) · 240.000".
- Chạm nút = `onAdd(variantId)`. Đây là đường thêm một chạm hiện có, nên giữ nguyên mọi kiểm tra: hết món, `allow_oversell`, thiếu giá.
- Nút của hàng cân (`dimension` khác `count`) và hàng serial/lô (`tracked_mode` khác `none`) không thêm ngay, mà mở `AddItemForm` của đúng variant đó (cần số cân hoặc serial).
- Sản phẩm chỉ có một variant thì hiện như hôm nay, kèm nhãn đơn vị nếu có quy đổi.
- Khi tắt: không gom hàng. Vẫn hiện `options_text` cạnh SKU, vì đây là sửa lỗi hiển thị (các variant đang trông giống hệt nhau), không phải tính năng mới.
- Quét mã vạch không đổi: luôn thêm đúng variant của mã.

### Ăn uống: thực đơn

POS (`menu-grid.tsx`, `lib/menu-selection.ts`):

- Khi bật, món có size hoặc có nhóm tuỳ chọn được hiện dạng hàng (một món một hàng, rộng hết cột) thay cho ô ảnh. Món một chạm vẫn là ô như cũ.
- Trên hàng món:
  - Dải nút size (variant), chọn sẵn variant đầu.
  - Nhóm chọn một (`max_select = 1`) có tối đa 6 tuỳ chọn, như đá, đường: dải nút ngay trên hàng, chọn sẵn theo `default_selected`.
  - Nhóm chọn nhiều hoặc nhiều hơn 6 tuỳ chọn, như topping: nút "+ Tuỳ chọn (n)" mở `ModifierSheet` với `initial` lấy từ lựa chọn trên hàng. Xác nhận trong sheet là thêm luôn.
  - Nút **Thêm · giá** (giá đã cộng `price_delta`) gọi `onAdd(variantId, { modifiers, merge: true })`. Thêm xong thì hàng trở về mặc định.
- Nút Thêm bị tắt khi một nhóm `required` chưa đủ `min_select` (ví dụ topping bắt buộc mà chưa chọn), kèm gợi ý "Chọn {{group}}".
- Combo (`kind: 'combo'`) và món có `allow_quantity` vẫn mở sheet như cũ.
- Phím số 1–9 cho món yêu thích vẫn mở sheet (hoặc thêm một chạm), không đổi.
- Logic chọn mặc định, kiểm `min_select` và tính giá viết thành hàm thuần trong `lib/menu-selection.ts` (dùng lại với `ModifierSheet`), có unit test.
- Thực đơn offline (`menuData`) đã có đủ dữ liệu, không cần thêm gì ở server.

Dashboard: một dòng `ToggleRow` "Hiện phân loại ngay trên danh sách bán", mô tả "Size, thuộc tính và đơn vị quy đổi hiện sẵn trên từng món, chạm một lần là thêm".

## 2. Hẹn giao sau (`scheduled_delivery`)

Công tắc chỉ quyết định có hiện ô chọn ngày giờ trên màn bán hay không. Server luôn nhận và luôn lưu giờ hẹn, để tắt công tắc không làm mất lịch của đơn đang chờ giao. Đơn vẫn giữ `business_date` của ca. Giờ hẹn chỉ là lịch giao, không đổi báo cáo doanh thu, ca hay ngày kinh doanh.

Server:

- Migration: `spree_pos_deliveries.scheduled_at` (`timestamptz`, null), index `(branch_id, status, scheduled_at)`.
- `Deliveries::Assign.call` nhận `scheduled_at`:
  - Không gửi khoá thì giữ giá trị cũ. Gửi `null` thì xoá. Gửi chuỗi ISO 8601 thì đặt.
  - Từ chối với 409 `delivery_schedule_invalid` khi chuỗi không đọc được, sớm hơn bây giờ quá 5 phút, hoặc xa hơn 30 ngày.
  - Đơn đã có thanh toán vẫn đổi được giờ hẹn (khác phí giao, vì giờ hẹn không phải tiền).
  - Nằm trong cùng lệnh, cùng idempotency key và cùng kiểm lease như hôm nay. `Workspaces::DeliveriesController#assign` truyền thêm `params[:scheduled_at]` khi có khoá.
- `Delivery#to_pos` thêm `scheduled_at`. Audit của lệnh giao hàng ghi cả giờ hẹn trước và sau.
- Đổi giờ hẹn của đơn đã hoàn tất (đang `pending`): thêm lệnh `PATCH /pos/deliveries/:id/schedule`, cùng quyền với đổi trạng thái giao, ghi audit `delivery.reschedule`. Đơn `delivered` thì không đổi được.
- `Deliveries::List`: đơn `pending` sắp theo `scheduled_at` (null xếp cuối), rồi theo giờ tạo. Thêm lọc `scheduled_on=YYYY-MM-DD` theo giờ của cửa hàng.
- Hoá đơn và phiếu tạm tính (`receipt_builder.rb`, `print_documents/template_data.rb`): thêm dòng "Hẹn giao: HH:mm dd/MM" khi có giờ hẹn. Phiếu bếp in thêm "Giao lúc HH:mm" ở đầu phiếu (`Kitchen::Send.header_for`), để bếp biết làm trước hay sau.

POS:

- `delivery-form.tsx`: khi `scheduled_delivery` bật, hiện ô "Hẹn giao" gồm các nút nhanh "Giao ngay", "+30 phút", "+1 giờ", "Ngày mai", và ô `datetime-local`. Khi tắt, không hiện ô. Đơn đã có giờ hẹn vẫn hiện giờ hẹn ở dạng chỉ đọc, kèm nút xoá.
- Hàng đơn giao trong danh sách đơn giao và trên ticket: hiện "Hẹn 14:30", đổi sang nhãn "Trễ hẹn" khi đã quá giờ mà vẫn `pending`.
- Danh sách đơn giao có thêm lọc "Hôm nay / Ngày mai / Tất cả".
- Offline: đơn offline không gán giao hàng như hôm nay, nên không cần thêm gì.

Dashboard: `ToggleRow` "Hẹn giao sau" trong nhóm Xử lý đơn hàng, mô tả "Chọn ngày giờ giao trên đơn giao hàng. Ngày kinh doanh của đơn vẫn là ngày của ca". Khi cờ giao hàng của chi nhánh đang tắt, dòng hiện mờ kèm "Cần bật Giao hàng trước".

## 3. Tự in phiếu tạm tính khi lưu đơn (`auto_print_prebill`)

Quán cần một tờ giấy lúc ghi đơn, trước khi khách trả tiền. Phiếu tạm tính đã có. Việc còn lại là tự in nó lúc lưu đơn, không đợi đến lúc thanh toán.

"Lưu đơn" gồm các lệnh sau, khi đơn còn mở, chưa có khoản thanh toán nào và có ít nhất một dòng:

- **Treo đơn** (`park`) ở quầy.
- **Gửi bếp** và **Gửi và ở lại** ở bàn, tab bar và đơn quầy gửi bếp bằng tay.

Không tính các lệnh tự lưu (thêm dòng, đổi số lượng) và không tính lúc chốt đơn.

Cách in:

- Làm ở client, ngay sau khi lệnh lưu thành công, giống `auto_print_receipt`. Dùng chung đường in của phiếu tạm tính (`usePrintRoute(..., 'prebill')`: trạm in, máy in LAN hoặc trình duyệt) và mẫu mặc định của cửa hàng. Tách phần gửi in trong `prebill-dialog.tsx` thành hook `usePrebillPrint` để hộp thoại và lệnh tự in dùng chung.
- Chi nhánh chạy `fnb.postpay` (phiếu tạm tính được ghi lại): chỉ tự in khi đơn **chưa có** phiếu tạm tính nào còn hiệu lực. Nếu đã có thì không in lại và không xin duyệt, chỉ hiện thông báo "Đã có phiếu tạm tính. In lại từ nút Phiếu tạm tính". Như vậy tự in không bao giờ tạo yêu cầu duyệt in lại.
- Chi nhánh không ghi phiếu: lần lưu nào cũng in bản theo đơn lúc đó. Nếu hai lần lưu không đổi gì (cùng `revision`) thì không in lần hai.
- In lỗi (máy tắt, trình duyệt chặn) thì lệnh lưu vẫn thành công. Lỗi hiện như thông báo, kèm nút "In bằng trình duyệt" giống hộp thoại.
- Offline: không tự in phiếu tạm tính (lưu đơn offline không có các lệnh trên).

Máy trạm có cài đặt riêng giống tự in hoá đơn: `localStorage` lưu `on` hoặc `off`, chưa có thì theo chi nhánh (`receipt-preferences.ts` thêm `autoPrintPrebillEnabled()`).

Dashboard: `ToggleRow` "Tự in phiếu tạm tính khi lưu đơn", mô tả "In khi treo đơn hoặc gửi bếp, trước khi khách trả tiền. Với chi nhánh ghi nhận phiếu tạm tính, chỉ in tự động lần đầu".

## 4. In món đã huỷ (`print_void_tickets`)

Phiếu huỷ bếp hiện luôn in. Thêm công tắc để quán nào thấy ồn thì tắt. Món huỷ vẫn ghi trên đơn.

Server (`Kitchen::VoidSent.print!`):

- Đọc `SalesSettings.for(ticket.branch)['print_void_tickets']`. Nếu `false` thì không xếp `PrintJob`, chỉ ghi log mức info.
- Mọi thứ khác giữ nguyên: dòng giảm hoặc bị gỡ, `KitchenVoid`, đánh dấu `wasted`, audit `kitchen.void_sent`, phiếu `kind: 'void'` trên màn bếp kèm realtime, và lịch sử bếp (`Kitchen::History`). Bếp vẫn thấy món bị huỷ trên màn hình. Chỉ tờ giấy là không in.
- In lại phiếu huỷ bằng tay từ lịch sử bếp (nếu có) vẫn được, vì đó là thao tác chủ động.
- Huỷ do nền tảng giao đồ ăn (`PLATFORM_CANCELED`) đi cùng đường `void!` / `print!`, nên theo cùng công tắc.

Dashboard: `ToggleRow` "In cả món đã huỷ" trong nhóm Tự động in, mô tả "Gửi phiếu HUỶ MÓN ra máy in của trạm bếp. Tắt thì món huỷ vẫn hiện trên màn bếp và vẫn ghi trên đơn". Khi `fnb.kitchen` tắt, dòng hiện mờ kèm "Cần bật Quản lý bếp trước". Bỏ câu "phiếu huỷ luôn được in" trong mô tả module bếp mà plan trước đã thêm.

## Các bước thực hiện

1. **Khoá chung**: thêm bốn khoá vào `packages/pos-shared/src/sales-settings.ts` (keys, type, defaults, normalize) và test, vào `Spree::Pos::SalesSettings::BOOLEAN`, và vào OpenAPI `pos-staff.yaml`. Thêm chuỗi vi/en cho dashboard và POS.
2. **In món đã huỷ** (nhỏ nhất, làm trước để chốt khung): `VoidSent.print!` kiểm khoá, dòng dashboard, spec.
3. **Hiện phân loại, bán lẻ**: `CatalogReader` (`options_text`, `unit`, `group=product`), offline snapshot, gom hàng trong `catalog-search.tsx`, nút phân loại, chuyển hàng cân và serial sang `AddItemForm`.
4. **Hiện phân loại, thực đơn**: hàm thuần trong `menu-selection.ts`, hàng món có dải size và nhóm chọn một, nút "+ Tuỳ chọn" mở `ModifierSheet` với `initial`.
5. **Hẹn giao sau**: migration, `Assign`, `to_pos`, lệnh đổi giờ hẹn, `List`, in trên hoá đơn và phiếu bếp, form và danh sách ở POS, dòng dashboard.
6. **Tự in phiếu tạm tính**: tách `usePrebillPrint` ra khỏi `prebill-dialog.tsx`, gọi sau `park` và sau gửi bếp, xử lý chi nhánh có ghi phiếu, cài đặt theo máy, dòng dashboard.
7. **Tài liệu**: thêm bốn khoá vào phần `sales_settings` của `apps/pos-dashboard/AGENTS.md`. Cập nhật dòng "In cả món đã huỷ" trong bảng đối chiếu của plan trước.

## Kiểm thử

Chỉ chạy spec liên quan, không chạy cả bộ.

- `pnpm --dir packages/pos-shared test`: `sales-settings.test.ts` (bốn khoá, mặc định, giá trị sai thì về mặc định).
- `apps/pos` unit: hàm chọn mặc định, kiểm `min_select` và tính giá trong `menu-selection.test.ts`; gom hàng theo sản phẩm; `receipt-preferences.test.ts` cho `autoPrintPrebillEnabled`; `deliveries.test.ts` cho nhãn "Trễ hẹn".
- `pnpm spree rspec`:
  - spec của `sales_settings` (nhận bốn khoá, giá trị không phải boolean thì 422).
  - spec của `kitchen/void_sent` (tắt thì không có `PrintJob` nhưng vẫn có `KitchenVoid`, phiếu `void` và audit; bật thì như cũ).
  - spec của catalog (`options_text`, `unit`, thứ tự `group=product`, không thêm truy vấn theo từng hàng).
  - spec của deliveries (đặt, giữ, xoá giờ hẹn; 409 khi quá khứ hoặc quá 30 ngày; đổi giờ hẹn sau khi hoàn tất; `delivered` thì không đổi được; thứ tự và lọc của `List`; `business_date` không đổi).
- POS e2e, `--project desktop`: danh mục có nút phân loại, thực đơn có hàng món với size và đá, form giao hàng có giờ hẹn, tự in phiếu tạm tính khi treo đơn và khi gửi bếp (chi nhánh ghi phiếu chỉ in lần đầu). Thêm `--project tablet --project mobile` cho spec của danh mục và thực đơn, vì bố cục hàng thay đổi.
- Dashboard e2e: `e2e/branch-features.spec.ts` thêm bốn dòng, trạng thái mờ khi thiếu module hoặc cờ, Lưu/Huỷ.

## Tiêu chí hoàn thành

- Bật `inline_variants` thì sản phẩm nhiều phân loại thêm được đúng variant bằng một chạm, món có size, đá, đường thêm được bằng chọn trên hàng rồi bấm Thêm, không mở sheet. Tắt thì như hôm nay, chỉ thêm tên phân loại cạnh SKU.
- Bật `scheduled_delivery` thì đặt được giờ giao trên đơn giao. Giờ hẹn hiện trên danh sách đơn giao, hoá đơn và phiếu bếp. Tắt thì ô chọn biến mất nhưng giờ hẹn đã lưu vẫn còn. `business_date` của đơn không bao giờ đổi theo giờ hẹn.
- Bật `auto_print_prebill` thì treo đơn hoặc gửi bếp in ra phiếu tạm tính mà không phải mở hộp thoại. Tự in không bao giờ tạo yêu cầu duyệt in lại.
- Tắt `print_void_tickets` thì máy in bếp không ra phiếu huỷ, còn màn bếp, đơn, báo cáo huỷ món và audit vẫn đầy đủ.

## Giới hạn đã biết

- Gom hàng trong danh mục bán lẻ chỉ gom trong một trang kết quả.
- Mỗi variant chỉ có một đơn vị bán (`VariantUnit`), nên "đơn vị quy đổi" trên hàng là đơn vị của từng variant. Nếu sau này một SKU bán được nhiều đơn vị (lon và thùng trên cùng một variant), cần thêm bảng đơn vị phụ. Việc đó nằm ngoài plan này.
- Tự in phiếu tạm tính qua trình duyệt có thể bị chặn nếu trình duyệt không cho `window.print()` sau một lệnh bất đồng bộ. Khi đó người bán thấy thông báo và nút in tay. Trạm in và máy in LAN không bị ảnh hưởng.
- Giờ hẹn không giữ chỗ cho người giao và không nhắc giờ. Nhắc trước giờ giao để sau.
