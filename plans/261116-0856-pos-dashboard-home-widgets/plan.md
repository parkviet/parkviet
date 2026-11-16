# Trang chủ POS dashboard dạng widget

Trạng thái: đã chốt các quyết định chính, chờ duyệt để bắt đầu. Chưa viết code.

## Mục tiêu

Thay trang `Việc cần xử lý` (`apps/pos-dashboard/src/pages/home.tsx`, 6 thẻ đếm xếp lưới cố định) bằng trang tổng quan gồm các widget:

1. Thẻ đơn giản, hiện đại, có biểu đồ.
2. Người dùng kéo đổi vị trí, đổi kích thước, bật/tắt và thêm lại widget ("Tùy chỉnh", "Thêm tiện ích").
3. Biểu đồ dùng API sẵn có; thiếu thì thêm endpoint mới.

Không đổi: bộ chọn chi nhánh, quyền theo capability của chi nhánh, hook và link của 6 thẻ "việc cần xử lý" (`data-testid` giữ nguyên).

## Quyết định đã chốt

1. Bố cục lưu **theo từng người dùng** ở máy chủ.
2. "Việc cần xử lý" **không còn là hàng cố định**: 6 thẻ cũ là widget kéo thả, bật/tắt được như mọi widget khác.
3. Có widget **Khách hàng** (biểu đồ xu hướng có tab Khách hàng).
4. Có **so sánh với kỳ trước** (chỉ số tăng/giảm trên thẻ số, đường kỳ trước trên biểu đồ xu hướng).
5. Chế độ chỉnh sửa có nút **Thiết lập lại**.
6. Đơn bán lẻ không gắn khách vẫn tính **một lượt khách** (widget Khách hàng = số đơn có người mua, cộng khách có tài khoản không đếm trùng trong cùng một đơn).
7. Không làm đổi tên widget.
8. Bấm vào thẻ hoặc biểu đồ mở **báo cáo chi tiết** đúng bộ lọc (xem mục Drill-down).
9. Thêm `react-grid-layout` làm phụ thuộc mới (đã đồng ý).
10. Parkviet chưa có trạng thái "chờ xác nhận" / "đang xử lý". Hai thẻ này **để sau**, làm cùng đợt mở rộng trạng thái đơn hàng. Widget "Tỷ lệ đơn theo trạng thái" chỉ dùng các trạng thái Parkviet đang có (hoàn tất, còn nợ, có trả hàng, hoàn tiền chưa xong...), khi có trạng thái mới thì thêm vào registry.

## Hiện trạng (đã kiểm tra trong mã)

**Bố cục tham khảo** (khảo sát ngoài repo): thanh lọc ngày + "so sánh kỳ trước", nút Tùy chỉnh và Thêm tiện ích; thẻ số (tổng tiền đơn, tổng đơn, chờ xác nhận, đang xử lý); biểu đồ xu hướng; top 5 sản phẩm; cảnh báo hàng hoá; tỷ lệ đơn theo trạng thái; bảng doanh thu theo ngày.

**Chế độ chỉnh sửa tham khảo**:
- Dùng GridStack: lưới **12 cột**, chiều cao ô **64px**, khoảng cách **8px**. Mỗi widget có `w/h` mặc định và giới hạn min/max: thẻ số 3x2 (tối thiểu 2x2, tối đa 4x3), biểu đồ xu hướng 8x7 (5x5 đến 8x8), top 5 là 4x7 (4x6 đến 7x8), cảnh báo hàng hoá 6x6.
- Vào chế độ chỉnh sửa: đầu trang có nút quay lại và tiêu đề "Chỉnh sửa"; dải hướng dẫn có nút đóng ("nhấn giữ để di chuyển, hoặc kéo góc để đổi cỡ"; Parkviet không làm đổi tên widget).
- Mỗi widget: nút tròn đỏ dấu trừ (tắt widget), **tay nắm kéo** (6 chấm) ở giữa trên, **tay nắm đổi cỡ** ở góc dưới phải.
- Chân trang: **Thiết lập lại** / **Hủy** / **Xác nhận**.
- Hai kiểu nền widget: `default` (có đệm) và `no-padding` (thẻ trạng thái có dải đầu tô màu nhẹ). Biểu đồ là ECharts.

**Parkviet**:
- `home.tsx`: 6 thẻ đếm từ `hooks/use-attention.ts`, `use-deliveries`, `use-orders`. Không có biểu đồ, không có layout tuỳ biến, không có thư viện biểu đồ hay kéo thả trong `apps/pos-dashboard`.
- `recharts` 3.10.1 đã là phụ thuộc của `@spree/dashboard-ui` (dashboard Spree dùng `Bar, ComposedChart, Line` trong `report-view.tsx`). Cần xác nhận pos-dashboard import được trực tiếp hay phải khai báo cùng phiên bản. Không thêm thư viện biểu đồ thứ hai.
- Dashboard Spree dùng `useReportingQuery` và `useDashboardCounters` của Admin API chuẩn: số liệu cả cửa hàng, không theo chi nhánh/ca POS, và doanh thu POS tính theo `business_date` của workspace chứ không theo `completed_at`. Không dùng lại cho POS, chỉ mượn cách vẽ.
- API POS sẵn có: `GET /pos/reports/:report` (`reports_controller.rb`). `sales` đã có `summary` gồm `orders`, `sales_total`, `returns_total`, `net_sales`, `by_source`, và hàm `by_hour`.

## Khoảng trống API

| Widget | Có sẵn | Thiếu |
|---|---|---|
| Tổng tiền đơn, tổng đơn, doanh thu thuần | `sales` summary theo khoảng ngày | Kỳ trước: gọi 2 lần (kỳ này, kỳ trước) hoặc để endpoint tổng quan trả sẵn |
| Xu hướng theo ngày (doanh thu, đơn, khách) | Không | Chuỗi theo ngày: thêm `by_day` (theo `business_date`) |
| Doanh thu theo giờ | `by_hour` có trong model | Chưa chắc đã ra JSON, cần kiểm tra |
| Doanh thu theo nguồn đơn | `summary.by_source` | Không |
| Top 5 sản phẩm bán chạy | Không | Thêm `Reports::TopItems` (số lượng, doanh thu) |
| Tỷ lệ đơn theo trạng thái | Đếm từng trạng thái qua `orders?status=` | Endpoint đếm gộp |
| Cảnh báo hàng hoá | trang `stock-alerts` | Cần xem hook/endpoint đếm hết hàng, sắp hết, sắp hết hạn |
| Công nợ, quỹ, ca đang mở | `receivables`, `funds`, `shifts` | Chỉ đếm/tổng cho thẻ |
| Khách hàng theo ngày | Không | Đếm khách duy nhất theo ngày trong `by_day`; cần chốt cách tính đơn bán lẻ không gắn khách (câu hỏi mở 1) |

Đề xuất gộp phần thiếu thành **một endpoint** `GET /pos/overview?branch_id&from&to&compare=1`, trả `{ totals, previous_totals, by_day, by_hour, by_source, top_items, status_counts, stock_alerts }`. Một lần gọi cho cả trang; quyền và phạm vi (`scope`: branch hay own) xử lý một chỗ như `ReportsController`; dùng chung truy vấn `Reports::Sales` để số khớp `/reports`. Nhược điểm: payload lớn hơn, có thể tách `top_items` nếu chậm.

## Thiết kế giao diện

- Lưới 12 cột, `rowHeight` 64px, margin 8px, giới hạn min/max cho từng widget trong registry (thẻ số 3x2, biểu đồ xu hướng 8x7, top 5 là 4x7 làm điểm xuất phát).
- **Chế độ xem**: chỉ đọc; thanh lọc ngày, "So sánh với kỳ trước", nút **Tùy chỉnh** và **Thêm tiện ích**.
- **Chế độ chỉnh sửa**: dải hướng dẫn, nút trừ/tay nắm kéo/tay nắm đổi cỡ trên từng widget, chân trang **Thiết lập lại / Hủy / Xác nhận**.
  - **Thiết lập lại**: đưa bản nháp về bố cục mặc định, có hỏi xác nhận (`useConfirm`), chỉ lưu khi bấm Xác nhận.
  - **Hủy**: bỏ bản nháp. **Xác nhận**: ghi lên máy chủ.
- **Thêm tiện ích**: ngăn liệt kê widget đang tắt (và widget mới thêm sau này), bấm để thêm vào chỗ trống đầu tiên.
- Mobile: một cột, không kéo thả (Tùy chỉnh chỉ cho bật/tắt).
- Widget (chỉ hiện nếu người dùng có capability và chi nhánh có module tương ứng, như hiện nay):
  - Việc cần xử lý: 6 thẻ cũ.
  - Thẻ số: tổng tiền đơn hàng, tổng đơn hàng, doanh thu thuần, trả hàng, đơn offline (chờ xác nhận, đang xử lý để sau); có chỉ số tăng/giảm so với kỳ trước.
  - Biểu đồ: xu hướng (tab Doanh thu / Đơn hàng / Khách hàng, đổi cột/đường, kèm đường kỳ trước), doanh thu theo giờ, doanh thu theo nguồn đơn, tỷ lệ đơn theo trạng thái, top 5 sản phẩm (tab Số lượng / Doanh thu).
  - Bảng: doanh thu theo ngày; cảnh báo hàng hoá.
- Phong cách theo `apps/pos-dashboard/DESIGN.md` và `@spree/dashboard-ui`, không thêm hệ màu mới. Mỗi widget tự có trạng thái tải, lỗi (`describeFailure`), rỗng; một widget lỗi không làm hỏng trang.

## Lưu bố cục (theo người dùng, ở máy chủ)

- Bảng `spree_pos_dashboard_layouts`: `store_id`, `user_id` (người dùng admin đang đăng nhập), `layout` JSON, `version`; duy nhất theo `(store_id, user_id)`. Bố cục theo cửa hàng, không theo chi nhánh: widget không áp dụng cho chi nhánh đang chọn thì ẩn nhưng vẫn giữ chỗ.
- Mỗi phần tử: `{ id, widget, x, y, w, h, options? }` (`options` ví dụ tab đang chọn).
- API: `GET /pos/dashboard_layout` (chưa có thì trả `null`, client dùng mặc định), `PUT` (kiểm tra schema, giới hạn số phần tử, chỉ nhận `widget` thuộc danh sách cho phép), `DELETE` (xoá bản ghi, về mặc định). Chỉ đọc/ghi bố cục của chính người dùng.
- Bố cục mặc định nằm trong mã (registry), nên widget mới thêm sau này tự xuất hiện trong "Thêm tiện ích" mà không đụng bố cục đã lưu.
- Ghi theo kiểu người ghi sau thắng; hai tab mở cùng lúc thì tab lưu sau thắng, không cần khoá.

## Các giai đoạn

1. **Khung widget và kéo thả (chỉ giao diện).** Thư viện lưới `react-grid-layout` (có min/max, tay nắm kéo riêng, đổi cỡ, 12 cột; GridStack khó tích hợp với React hơn). Registry widget, chuyển 6 thẻ cũ thành widget, chế độ chỉnh sửa đủ Thiết lập lại/Hủy/Xác nhận, Thêm tiện ích; tạm lưu `localStorage` để chạy được trước khi có API. Kiểm: typecheck, lint, e2e hiện có của trang chủ (`attention-*`).
2. **Thanh lọc ngày, so sánh kỳ trước, biểu đồ trên dữ liệu có sẵn.** Thẻ số và biểu đồ theo nguồn đơn từ `sales.summary`, gọi hai lần cho kỳ này và kỳ trước; dựng bộ biểu đồ `recharts` dùng chung. Kiểm: kiểm thử đơn vị, ảnh chụp 3 cỡ màn hình.
3. **Endpoint tổng quan (Rails).** `Spree::Pos::Overview` + controller + route + rspec: `by_day` (theo `business_date`, gồm khách duy nhất), `top_items`, `status_counts`, `stock_alerts`, kèm kỳ trước. Tôn trọng `Scope`, phạm vi `branch`/`own`, múi giờ chi nhánh. Cần dự án đã `eject`; chỉ chạy rspec file đã đổi. Kiểm: ranh giới ngày, trả hàng không trừ vào dòng bán, người không có quyền.
4. **Widget dùng endpoint mới.** Xu hướng (3 tab + đường kỳ trước), top 5, tỷ lệ trạng thái, doanh thu theo ngày, cảnh báo hàng hoá. Kiểu dữ liệu chung đặt ở `packages/pos-shared`.
5. **Lưu bố cục theo người dùng.** Migration, model, controller `dashboard_layout`, rspec; hook `useDashboardLayout` thay `localStorage`; Xác nhận sau Thiết lập lại gọi `DELETE`. Kiểm: người A đổi bố cục không ảnh hưởng người B.
6. **Hoàn thiện.** i18n `vi`/`en`, e2e Playwright (kéo, đổi cỡ, tắt, thêm, Thiết lập lại, Hủy, bấm thẻ mở đúng báo cáo; desktop, tablet, mobile), cập nhật `apps/pos-dashboard/AGENTS.md`.

Phụ thuộc: 1 → 2 → 4; 3 trước 4; 5 sau 1, độc lập với 2-4.

## Rủi ro

- `react-grid-layout` trên React 19 và `@spree/dashboard-core`: thử ngay ở giai đoạn 1.
- Truy vấn tổng hợp trên bảng đơn lớn (khoảng 30 ngày): cần chỉ mục theo `business_date` và chi nhánh, có thể cache ngắn.
- Số liệu phải khớp `/reports` cùng kỳ; dùng chung `Reports::Sales`, không viết truy vấn thứ hai.
- Nhiều phiên cùng dùng checkout: chạy kiểm thử chọn lọc theo `AGENTS.md`, không chạy full suite; không tự khởi động stack (bạn chạy `pnpm spree dev`).

## Tiêu chí hoàn thành

- Kéo, đổi cỡ, tắt, thêm widget hoạt động và còn sau khi tải lại; mỗi người dùng một bố cục riêng.
- Thiết lập lại, Hủy, Xác nhận hoạt động đúng như mô tả.
- 6 thẻ việc cần xử lý vẫn đúng quyền và số đếm như trước.
- Xu hướng (kèm khách hàng và kỳ trước), top 5, tỷ lệ trạng thái, doanh thu theo nguồn đơn, cảnh báo hàng hoá có dữ liệu thật của chi nhánh đang chọn.
- Số tổng khớp `/reports/sales` cùng kỳ; typecheck, lint, test, build và e2e liên quan qua; mọi chuỗi có `vi` và `en`.

## Drill-down: bấm thẻ mở báo cáo chi tiết

Mỗi widget có `to` kèm bộ lọc trên URL, dùng đúng khoá của `reportSearchSchema` (`from`, `to`, `orderSource`, `section`, `status`, ...) để mở lại trang đúng số liệu đã thấy. Khoảng ngày và chi nhánh của trang chủ được mang theo.

| Widget | Mở tới | Bộ lọc trên URL |
|---|---|---|
| Tổng tiền đơn hàng, tổng đơn hàng | Báo cáo Doanh số | `from`, `to` |
| Doanh thu thuần | Báo cáo Doanh số | `from`, `to` (và phần trả hàng ở `section=returns`) |
| Trả hàng | Báo cáo Doanh số | `section=returns`, `from`, `to` |
| Doanh thu theo nguồn đơn | Báo cáo Doanh số | `orderSource=<nguồn>`, `from`, `to` |
| Xu hướng, doanh thu theo ngày | Báo cáo Doanh số, nhóm theo ngày | `from`, `to` (bấm một ngày: `from=to=ngày đó`) |
| Top 5 sản phẩm | Báo cáo "Bán theo sản phẩm" (menu Báo cáo mới) | `from`, `to` |
| Tỷ lệ đơn theo trạng thái | Danh sách đơn | `status=<trạng thái>` (có sẵn trên `/orders`) |
| Cảnh báo hàng hoá | Trang cảnh báo tồn kho | `/stock-alerts` (có sẵn) |
| 6 thẻ việc cần xử lý | Như hiện nay | `/funds/attention`, `/credit-approvals`, `/shifts`, `/deliveries`, `/orders?status=refund_pending` |
| Khách hàng | Báo cáo "Bán theo khách" | `from`, `to` |

Cần thêm các khoá lọc mới vào `reportSearchSchema` khi báo cáo mới có (xem plan báo cáo). Danh sách đơn chưa chắc nhận mọi trạng thái cần cho "Tỷ lệ theo trạng thái": cần đối chiếu `ORDER_STATUSES` ở giai đoạn 3.

## Câu hỏi mở

Không còn câu hỏi chặn giai đoạn 1. Trạng thái đơn mới thuộc một kế hoạch riêng về đơn hàng.
