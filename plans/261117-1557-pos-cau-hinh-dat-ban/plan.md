# Cấu hình đặt bàn trên tab "Sơ đồ bàn"

Trạng thái: đã làm xong bốn bước. Còn lại: sinh lại client Dart `apps/pos-staff/packages/pos_api` cho các trường mới; chưa có ca Playwright cho thẻ trên dashboard (cổng 5176 đang bận khi làm).

Tham khảo bố cục màn "Cấu hình đặt bàn" của sản phẩm tham khảo (khảo sát ngoài repo). Đặt thành một thẻ mới **Đặt bàn**, nằm dưới thẻ "Phục vụ tại bàn" trên tab Sơ đồ bàn của chi nhánh. Thẻ chỉ hiện khi chi nhánh bật module `fnb.reservations`.

Hai quyết định đã chốt với người dùng:

- **Quy tắc với nhân viên: chỉ cảnh báo.** Đặt bàn trên POS ngoài khung giờ, sát giờ mở/đóng, hoặc quá sát giờ hiện tại thì POS cảnh báo và hỏi lại, nhân viên vẫn đặt được. Chặn hẳn chỉ dành cho kênh khách tự đặt online, hiện chưa có.
- **Khung giờ phục vụ: tối đa 4 khung mỗi chi nhánh.** Chưa đặt khung nào thì lấy giờ mở cửa làm một khung. Khung được phép qua nửa đêm.

Gọi là **"Khung giờ phục vụ"**, không gọi "Ca bán hàng" như sản phẩm tham khảo, vì "ca" trong Parkviet đã là ca thu ngân (mở/đóng két).

## Hiện trạng (đã đọc mã)

- **Thời lượng đặt bàn** đã có: `spree_pos_branches.reservation_duration_minutes`. `Reservations::Guard.period!` dùng nó làm giờ kết thúc mặc định, và giữ bàn cho hết khoảng đó (`ReservationResource`, ràng buộc exclusion chống trùng). Đây tương ứng với tùy chọn "Thời gian dự kiến khách sử dụng bàn".
- **Thời gian chờ khách đến muộn** đã có: `reservation_grace_minutes`. `MarkNoShowJob` chuyển đơn quá giờ cộng số phút này sang `no_show` và nhả bàn.
- Cả hai trường có trong `Tables::Settings` (`GET/PUT /pos/table_settings`, kiểm tra 1–1440 phút, audit `table_settings.update`), nhưng **chưa màn hình nào sửa được**. Chỉ client Flutter sinh tự động biết hai trường này.
- **Cảnh báo bàn ngồi lâu** (`seated_alert_minutes`) đã nằm trong thẻ "Phục vụ tại bàn". Nó áp dụng cho khách đã ngồi, không phải đặt bàn, nên giữ nguyên chỗ cũ, không lặp lại trong thẻ mới.
- **Giờ mở cửa**: `StoreInfo.opening_time` / `closing_time` của cửa hàng, chi nhánh ghi đè được qua `BranchInfo`. `StoreInfo.effective(branch)[:opening_hours]` trả `{ opening, closing, source }`. Sửa ở trang Thông tin cửa hàng (`store-info.tsx`). Chỉ có một cặp giờ.
- **Ngày kinh doanh** cắt theo `branch.effective_business_day_cutoff` (mặc định 04:00), giờ theo `branch.timezone`.
- **Ai đặt bàn**: chỉ nhân viên, trên trang Đặt bàn của POS (`apps/pos/src/pages/reservations.tsx`): chọn ngày, giờ (`type="time"`), số khách, rồi chọn bàn trống từ `useAvailability`. `Reservation::SOURCES = phone walk_in online`, nhưng `online` hiện cũng do nhân viên nhập.
- **Tính tiền theo giờ** cấu hình theo sản phẩm, không liên quan đặt bàn.

## Đối chiếu với sản phẩm tham khảo

| Sản phẩm tham khảo | Parkviet |
|---|---|
| Thời gian dự kiến khách sử dụng bàn | Đã có: `reservation_duration_minutes`. Chỉ cần đưa lên màn hình. |
| (không có) | Đã có: `reservation_grace_minutes`, chờ khách muộn trước khi tính vắng mặt. Đưa lên cùng mục. |
| Thời gian bán hàng (danh sách ca) | Mới: `reservation_periods`, tối đa 4 khung. |
| Nhận đặt bàn đầu ca sau | Mới: `reservation_open_buffer_minutes`. |
| Ngừng nhận đặt bàn trước cuối ca | Mới: `reservation_close_buffer_minutes`. |
| Đặt bàn tối thiểu trước | Mới: `reservation_min_lead_minutes`. |
| Minh hoạ các ca bán hàng | Mới, chỉ ở dashboard, tính hoàn toàn phía client. |

## 1. Dữ liệu và server

Migration (thêm cột vào `spree_pos_branches`):

| Cột | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `reservation_periods` | jsonb | `[]` | Mảng `{ "start": "HH:MM", "end": "HH:MM" }`, tối đa 4 |
| `reservation_open_buffer_minutes` | integer | `0` | 0–999 |
| `reservation_close_buffer_minutes` | integer | `0` | 0–999 |
| `reservation_min_lead_minutes` | integer | `0` | 0–999 |

Mặc định giữ đúng hành vi hôm nay: không khung, không đệm, không yêu cầu đặt trước. Không cần backfill.

Kiểm tra khi lưu (trong `Tables::Settings.reservations!`, cùng chỗ hai trường cũ):

- Giờ dạng `HH:MM` 00:00–23:59. `end < start` nghĩa là qua nửa đêm. `end == start` bị từ chối.
- Các khung không chồng nhau, tính trên vòng 24 giờ. Thứ tự lưu là thứ tự theo giờ bắt đầu, tính từ giờ cắt ngày kinh doanh (khung 22:00–02:00 đứng sau khung 17:00–21:00).
- Với mỗi khung, `open_buffer + close_buffer` phải nhỏ hơn độ dài khung. Nếu không, khung không còn phút nào nhận đặt: lỗi `reservation_window_empty`, kèm chỉ số khung.
- Lỗi chung: `reservation_periods_invalid` (sai định dạng, quá 4, chồng nhau), `reservation_settings_invalid` (phút ngoài khoảng, dùng lại mã cũ).
- `to_pos` trả thêm bốn trường mới, cùng `reservation_effective_periods`: chính là `reservation_periods`, hoặc khi rỗng thì `[{ start: opening, end: closing }]` từ giờ mở cửa đang áp dụng, hoặc `[]` nếu cũng chưa có giờ mở cửa (khi đó không có quy tắc khung giờ). Kèm `reservation_periods_source`: `branch`, `opening_hours` hoặc `none`.
- Controller permit thêm `reservation_open_buffer_minutes`, `reservation_close_buffer_minutes`, `reservation_min_lead_minutes`, `reservation_periods: [:start, :end]`. Audit vẫn là `table_settings.update` với before/after.

Dịch vụ mới `Reservations::Window` (thuần, không truy vấn):

- `reasons(branch, starts_at:, now:)` trả mảng lý do trong số `outside_periods`, `before_open`, `after_close`, `too_soon`. Rỗng là hợp lệ. Giờ tính theo `branch.timezone`.
- Một thời điểm thuộc khung nếu nằm trong `[start, end)`. Thuộc khung nhưng trước `start + open_buffer` là `before_open`. Sau `end - close_buffer` (mốc cuối vẫn nhận) là `after_close`. Không thuộc khung nào là `outside_periods`.
- `starts_at < now + min_lead` là `too_soon`.
- Không xét giờ kết thúc: đơn đặt sát giờ đóng có thể kéo quá giờ đóng.

Áp dụng (chế độ "chỉ cảnh báo"):

- `Reservations::Create` và `Update` (khi đổi giờ) tính `Window.reasons`, **không từ chối**, và ghi vào metadata audit `outside_rules: [...]` khi khác rỗng. Chủ quán sau này lọc được các đơn đặt ngoài quy tắc.
- `source = walk_in` bỏ qua hoàn toàn (khách đã đến).
- Để sẵn tham số `strict:` cho `Window`: kênh khách tự đặt online sau này gọi với `strict: true` và trả `Conflict reason: 'reservation_outside_rules', details: { reasons: [...] }`. Kế hoạch này không làm kênh đó.

OpenAPI (`server/openapi/pos-staff.yaml`): thêm các trường vào `TableSettings` và `TableSettingsInput`. Client Dart trong `apps/pos-staff/packages/pos_api` sinh lại theo cách repo đang sinh (xem README của package), nếu không chạy được thì ghi chú trong PR.

## 2. Logic dùng chung (`packages/pos-shared`)

File mới `src/reservation-window.ts`, cùng logic với `Reservations::Window` để dashboard và POS không tự viết lại:

- `effectivePeriods(settings)`: đọc `reservation_effective_periods`.
- `acceptWindows(period, openBuffer, closeBuffer)`: khoảng nhận đặt của một khung, theo phút từ giờ cắt ngày kinh doanh. Dùng cho minh hoạ và cho gợi ý giờ trên POS.
- `bookingReasons({ startsAt, now, timezone, periods, openBuffer, closeBuffer, minLead })`: trả cùng bộ lý do như server.
- `validatePeriods(periods, openBuffer, closeBuffer)`: lỗi theo từng khung (sai giờ, trùng, khung rỗng), để dashboard báo ngay trước khi lưu.
- Unit test bao: khung qua nửa đêm, hai khung sát nhau (21:00 kết thúc, 21:00 bắt đầu, không tính là chồng), đệm bằng đúng độ dài khung, múi giờ khác UTC, `min_lead = 0`.

## 3. Dashboard: thẻ "Đặt bàn" (`apps/pos-dashboard/src/pages/branch-floor-plan.tsx`)

`ReservationSettingsCard`, đặt ngay sau `<TableSettingsCard />`. Hiện khi `modules['fnb.reservations'] === true`. Quyền sửa giống thẻ "Phục vụ tại bàn" (`canManageBranch`). Thẻ có nháp riêng và nút lưu riêng, chỉ gửi các khoá đặt bàn lên `PUT /pos/table_settings` (server chỉ đổi khoá được gửi).

Các mục, theo thứ tự:

1. **Thời gian sử dụng bàn**
   - "Thời gian dự kiến khách dùng bàn" (`reservation_duration_minutes`, 1–1440, ô số có nút −/+ và chữ "phút"). Gợi ý: "Tính từ giờ khách đặt. Bàn được giữ hết khoảng này, nên đơn khác không đặt chồng được."
   - "Chờ khách đến muộn" (`reservation_grace_minutes`, 1–1440). Gợi ý: "Quá giờ đặt cộng số phút này mà khách chưa đến thì đơn chuyển sang Vắng mặt và bàn được nhả."
2. **Khung giờ phục vụ**
   - Danh sách khung: "Khung 1  [10:00] – [14:00]  (xoá)". Nút "Thêm khung giờ", tắt khi đã đủ 4 khung.
   - Khi chưa có khung: một dòng chỉ đọc "Đang dùng giờ mở cửa 08:00 – 22:00" với liên kết sang trang Thông tin cửa hàng, và nút "Chia thành nhiều khung" (tạo sẵn khung 1 bằng giờ mở cửa). Khi chưa có cả giờ mở cửa: "Chưa có giờ mở cửa, nên nhận đặt bàn mọi giờ."
   - Lỗi hiện ngay dưới khung bị lỗi (trùng khung, giờ bằng nhau, khung rỗng sau khi trừ đệm).
3. **Quy tắc nhận đặt bàn trong khung** ("Áp dụng chung cho mọi khung giờ.")
   - "Nhận đặt bàn sau giờ mở khung" (`reservation_open_buffer_minutes`, 0–999). VD: "Khung mở 10:00, 30 phút: nhận đặt từ 10:30."
   - "Ngừng nhận đặt bàn trước giờ đóng khung" (`reservation_close_buffer_minutes`, 0–999). VD: "Khung đóng 22:00, 60 phút: nhận đặt muộn nhất 21:00."
4. **Đặt bàn tối thiểu trước** (`reservation_min_lead_minutes`, 0–999). VD: "30 phút: bây giờ 18:00 thì chỉ đặt được từ 18:30."
5. **Minh hoạ**: trục ngang từ giờ cắt ngày kinh doanh đến hết ngày đó (24 giờ, nên khung qua nửa đêm vẫn liền một đoạn). Mỗi khung vẽ ba màu: đệm đầu, khoảng nhận đặt, đệm cuối. Khoảng trống giữa các khung là giờ nghỉ. Có chú thích ba màu và mốc giờ của từng khung. Vẽ bằng div và Tailwind, không cần thư viện biểu đồ. Cập nhật theo nháp, trước khi lưu.
6. **Thanh lưu**: "Huỷ" (bỏ nháp) và "Lưu cấu hình", giống thanh lưu của tab Chức năng. Tắt nút lưu khi nháp còn lỗi.

Ô số có nút −/+: tạo `MinuteStepper` nhỏ trong file (ô `inputMode="numeric"`, hai nút ghost `aria-label` "Giảm"/"Tăng", chữ "phút"), trừ khi dashboard đã có component tương tự. Tìm trong `src/components` trước khi tạo.

Bản dịch thêm vào `apps/pos-dashboard/src/locales/vi.json` và `en.json`, trong nhóm `floorPlan.reservation*`, cùng các lỗi `reservation_periods_invalid`, `reservation_window_empty` vào danh sách lỗi của trang (cạnh `seated_alert_minutes_invalid`).

## 4. POS: cảnh báo khi đặt bàn (`apps/pos/src/pages/reservations.tsx`)

- Đọc `GET /pos/table_settings` (đọc được bằng `read_pos_orders`), qua một hook mới hoặc hook sẵn có nếu đã có.
- Dưới ô giờ: dòng gợi ý các khoảng nhận đặt trong ngày đã chọn, ví dụ "Nhận đặt 10:30–13:00, 17:30–21:00".
- Khi giờ chọn có lý do (`bookingReasons` khác rỗng): hiện cảnh báo ngay dưới ô giờ, mỗi lý do một câu ("Ngoài khung giờ phục vụ", "Chưa tới giờ nhận đặt của khung (từ 10:30)", "Đã qua giờ nhận đặt cuối của khung (21:00)", "Cần đặt trước ít nhất 30 phút"). Nút "Đặt bàn" đổi thành "Vẫn đặt bàn"; lần bấm đầu không gửi mà chỉ đưa con trỏ tới cảnh báo, lần hai mới gửi. Cách này không thêm hộp thoại.
- Sửa giờ của một đơn đã đặt (nếu màn sửa có ô giờ) dùng cùng cảnh báo.
- Không chặn gì phía client, đúng quyết định "chỉ cảnh báo".

## 5. Kiểm thử

Chỉ chạy spec liên quan, không chạy cả bộ.

- `server/spec/requests/spree/pos/table_settings_spec.rb`: lưu và đọc bốn trường mới; `reservation_effective_periods` rơi về giờ mở cửa và về `[]`; từ chối khung trùng, quá 4 khung, giờ sai, khung rỗng sau khi trừ đệm; chấp nhận khung qua nửa đêm.
- Spec mới `server/spec/services/spree/pos/reservations/window_spec.rb`: từng lý do, khung qua nửa đêm, múi giờ chi nhánh.
- Spec của `Reservations::Create` (request hoặc workflow, chọn file đang có): đặt ngoài quy tắc vẫn thành công và audit có `outside_rules`; `walk_in` không có `outside_rules`.
- `pnpm --dir packages/pos-shared test` cho `reservation-window.test.ts`.
- Typecheck `apps/pos-dashboard` và `apps/pos`.
- Playwright: `apps/pos/e2e/reservations.spec.ts` thêm một ca cảnh báo và "Vẫn đặt bàn". Dashboard: thêm ca cho thẻ Đặt bàn vào spec sơ đồ bàn nếu có, `--project desktop`.

## Thứ tự làm

1. Migration, `Tables::Settings`, controller, `Reservations::Window`, audit trong Create/Update, OpenAPI, spec server.
2. `pos-shared/reservation-window.ts` và test.
3. Thẻ Đặt bàn trên dashboard.
4. Cảnh báo trên POS.

## Ngoài phạm vi

- Kênh khách tự đặt online (dùng `Window` với `strict: true` khi làm).
- Khung giờ khác nhau theo thứ trong tuần, ngày lễ.
- Nhiều cặp giờ mở cửa trong trang Thông tin cửa hàng.
- Tự động gợi ý bàn theo thời lượng còn lại trước giờ đóng.
