# Menu Báo cáo nhiều mục con cho POS dashboard

Trạng thái: bản nháp chờ duyệt. Chưa viết code. Đi cùng [kế hoạch trang chủ widget](../261116-0856-pos-dashboard-home-widgets/plan.md): các widget trang chủ mở thẳng vào các báo cáo này.

Sản phẩm tham khảo bên ngoài chỉ dùng để học cách sắp xếp, luồng nghiệp vụ và tính năng, không sao chép: tên mục, nhóm và nội dung theo nghiệp vụ F&B và đa chi nhánh của Parkviet.

## Quyết định đã chốt

1. Thêm `react-grid-layout` (cho trang chủ; trang Tổng quan báo cáo có bố cục cố định, không kéo thả).
2. `/reports` mở **Tổng quan báo cáo**, một trang **thiết kế mới** (mục bên dưới). Doanh số chuyển sang `/reports/sales`.
3. Trạng thái đơn còn thiếu (chờ xác nhận, đang xử lý...) để cho đợt làm đơn hàng; báo cáo chỉ dùng trạng thái đang có.
4. Giá vốn tính theo **bình quân gia quyền di động** (mục Giá vốn bên dưới).

## Mục tiêu

Hôm nay "Báo cáo" là **một mục sidebar** (`/reports`) với dải tab ngang (`PillTabs`) gồm 8 đến 14 báo cáo tuỳ module. Mục tiêu: đổi thành **nhóm menu có các mục con**, nhóm theo chủ đề, mỗi báo cáo một mục riêng có đường dẫn riêng, đồng thời bổ sung các báo cáo còn thiếu mà nghiệp vụ Parkviet cần.

## Hiện trạng

**Parkviet** (`pages/reports.tsx`, `lib/report-table.ts`, `routes/_authenticated/$storeId/reports/`):
- Mỗi tab đã là một route riêng (`/reports`, `/reports/receipts`, ...), nên chuyển sang menu con không phải làm lại route.
- Danh sách báo cáo do `dashboardReportTypes(modules, readsSponsors)` quyết định theo module của chi nhánh: `sales`, `receipts`, `cashbook`, `receivables`, `closures`, `ingredient_usage`, `menu_margin`, `platforms`, `meals`, `meal_statement`, `vehicle_commissions`, `attendants`, cộng báo cáo tính giờ.
- Bộ lọc nằm trên URL (`reportSearchSchema`: `from`, `to`, `registerId`, `shiftId`, `mine`, `section`, `orderSource`, `kind`, `source`, `status`, ...), khoảng ngày được mang theo giữa các tab.
- Máy chủ: `GET /pos/reports/:report`, lớp `Spree::Pos::Reports::*`; có xuất CSV bất đồng bộ (`ReportExports`, danh sách xuất hiện ở cuối mỗi trang).
- Doanh số tính theo `business_date` của chi nhánh (không cần mục cài đặt chọn cách ghi nhận ngày).
- `nav.ts` đang có một lá `reports` trong nhóm `reporting`; 6.0.3 không có tiêu đề nhóm, nhóm là mục cha có con.

**Bộ báo cáo tham khảo** (khảo sát ngoài repo):
- Tổng quan báo cáo: thẻ số (tổng tiền đơn, doanh thu thuần, trung bình/đơn, khách mới, lợi nhuận gộp, đơn hàng), chi tiết tổng tiền đơn (giá bán, giảm giá, trừ tích điểm, hoàn trả, phụ thu, phí vận chuyển, thuế), top 5 sản phẩm / khách hàng / nhân viên, biểu đồ xu hướng, tỷ lệ theo trạng thái.
- Doanh thu: theo nhân viên, khách hàng, sản phẩm, danh mục, doanh thu khác; theo nguồn đơn và kênh bán; theo ngày; theo đơn hàng.
- Lợi nhuận: doanh thu, chi phí, giá vốn, lợi nhuận gộp, chi tiết có công thức, tách theo ngày / đơn / sản phẩm / khách / nhân viên.
- Thu chi: tổng thu, tổng chi, chênh lệch, theo phân loại, theo nguồn tiền.
- Kho hàng: giá trị và số lượng tồn, nhập xuất kho trong kỳ, top 5 sản phẩm và danh mục có giá trị tồn cao nhất; **Tổng hợp tồn kho** (đầu kỳ, nhập, xuất, cuối kỳ theo sản phẩm, xuất Excel).
- **Lịch sử xuất báo cáo**: danh sách file đã xuất, người xuất, trạng thái.
- Cài đặt riêng "Quản lý báo cáo" chọn doanh thu ghi nhận theo ngày hoàn thành hay ngày đặt đơn.

## Cây menu đề xuất

Nhóm "Báo cáo" ở sidebar có các mục con theo chủ đề. Mục cha không có trang riêng, mở mục con đầu tiên người dùng được xem (đúng cơ chế `nav.ts` hiện tại).

| Mục | Báo cáo | Trạng thái |
|---|---|---|
| **Tổng quan** | Tổng quan báo cáo (số liệu kỳ này, so với kỳ trước, chi tiết tổng tiền đơn, top 5 sản phẩm / khách / nhân viên) | Mới |
| **Bán hàng** | Doanh số (đơn, trả hàng) | Có (`sales`) |
| | Bán theo sản phẩm, theo nhóm hàng | Mới |
| | Bán theo nhân viên (thu ngân) | Mới |
| | Bán theo khách hàng | Mới |
| | Bán theo nguồn đơn và kênh | Mới (từ `summary.by_source`) |
| | Nền tảng giao hàng (đối soát) | Có (`platforms`) |
| **Tiền** | Thực thu | Có (`receipts`) |
| | Tiền mặt trong két | Có (`cashbook`) |
| | Công nợ | Có (`receivables`) |
| | Đóng ca | Có (`closures`) |
| | Thu chi | Mới (cần phiếu thu chi tự do, chưa có) |
| **Lợi nhuận** | Lãi món | Có (`menu_margin`, theo công thức) |
| | Lợi nhuận tổng (doanh thu, giá vốn, chi phí, lợi nhuận gộp) | Mới, phụ thuộc có giá vốn |
| **Kho** | Tồn kho (giá trị, số lượng, top giá trị tồn) | Mới |
| | Nhập xuất tồn (đầu kỳ, nhập, xuất, cuối kỳ theo sản phẩm) | Mới |
| | Nguyên liệu tiêu hao | Có (`ingredient_usage`) |
| **Vận hành F&B** | Suất ăn căng tin, bảng kê đơn vị chi trả | Có (`meals`, `meal_statement`) |
| | Hoa hồng xe | Có (`vehicle_commissions`) |
| | Tiếp viên | Có (`attendants`) |
| | Tính giờ | Có (báo cáo tính giờ) |
| **Lịch sử xuất** | Danh sách file đã xuất của người dùng | Có phần dữ liệu (`ReportExports`), tách thành trang riêng |

Mục bị ẩn theo đúng điều kiện hiện nay (module của chi nhánh, capability `pos.report.read`, quyền đơn vị chi trả). Nhóm rỗng thì không đăng ký.

Lựa chọn riêng của Parkviet:
- **Không có mục cài đặt "ngày ghi nhận doanh thu"**: Parkviet đã tính theo ngày kinh doanh của chi nhánh (`business_date`, có giờ cắt ngày).
- Giữ nhóm **Vận hành F&B** (suất ăn, hoa hồng xe, tiếp viên, tính giờ), nghiệp vụ riêng của Parkviet.
- Báo cáo đóng ca, két, công nợ, đối soát sàn nằm trong nhóm Tiền vì đó là cách thu ngân và quản lý chi nhánh đọc.

## Báo cáo mới và nguồn dữ liệu

| Báo cáo mới | Dữ liệu có sẵn | Việc cần làm ở máy chủ |
|---|---|---|
| Tổng quan báo cáo | `sales.summary`, `by_source` | Dùng chung endpoint `/pos/overview` của kế hoạch trang chủ |
| Bán theo sản phẩm / nhóm hàng | Dòng hàng của đơn đã hoàn tất | Lớp `Reports::SalesByItem` (số lượng, doanh thu, theo kỳ, nhóm theo sản phẩm hoặc nhóm), kế thừa `Reports::Grouped` |
| Bán theo nhân viên | Ca (`shift.owner`) và workspace | `Reports::SalesByCashier` (đã có bộ lọc cashier trong `Sales`) |
| Bán theo khách hàng | Khách trên đơn | `Reports::SalesByCustomer`; đơn bán lẻ không gắn khách xếp vào một dòng "Khách lẻ" (mỗi đơn một lượt khách, theo quyết định trang chủ) |
| Bán theo nguồn đơn và kênh | `summary.by_source` | Chỉ cần một trang bảng + biểu đồ, hầu như không có việc ở máy chủ |
| Thu chi | `cashbook`, `receipts` | Cần phiếu thu chi tự do trước (chưa có) |
| Lợi nhuận tổng | Giá vốn theo công thức (`menu_margin`), giá nhập hàng | Cần chốt nguồn giá vốn cho hàng không có công thức; phụ thuộc quyết định kế toán |
| Tồn kho | Dữ liệu tồn, cảnh báo tồn | `Reports::StockValue` (giá trị = tồn x giá vốn; chọn giá vốn) |
| Nhập xuất tồn | Chứng từ nhập, xuất, kiểm kho, serial/lô | `Reports::StockMovement` (đầu kỳ, nhập, xuất, cuối kỳ) |
| Lịch sử xuất | `exports_controller`, `export_files_controller` | Không cần |

Báo cáo đều dùng khuôn sẵn có: `GET /pos/reports/:report` với bộ lọc allowlist, `Scope` (chi nhánh hay chỉ của mình), múi giờ chi nhánh, phân trang và xuất CSV. Thêm tên vào ràng buộc route `reports/:report` và `Reports::TYPES`.

## Trang Tổng quan báo cáo (thiết kế mới)

Mục đích: chủ quán hoặc quản lý chi nhánh nhìn một trang là biết kỳ này bán ra sao, tiền đã về chưa, giờ nào đông, món nào chạy, ai bán. Bố cục gồm thẻ số có so sánh kỳ trước, xu hướng, top 5; nội dung theo nghiệp vụ Parkviet: tách **doanh số** với **thực thu**, có **giờ cao điểm** và **nguồn đơn** (quầy, QR tại bàn, kiosk, sàn giao hàng).

Bố cục cố định, 12 cột, dùng chung component widget với trang chủ (một bộ biểu đồ, một bộ thẻ số). Mỗi khối có liên kết "Xem chi tiết" mở báo cáo con với cùng bộ lọc trên URL.

**Đầu trang**: tiêu đề, bộ chọn chi nhánh, chọn kỳ (Hôm nay, Hôm qua, 7 ngày, Tháng này, Tháng trước, Tuỳ chọn), "So với kỳ trước" (bật mặc định), nút Xuất.

**Hàng 1, thẻ số** (giá trị, mũi tên tăng/giảm, phần trăm so với kỳ trước):
- Doanh số (tổng tiền đơn), mở Doanh số.
- Doanh thu thuần (sau trả hàng), mở Doanh số phần trả hàng.
- Số đơn, mở Doanh số.
- Giá trị trung bình/đơn.
- Lượt khách (đơn bán lẻ tính một lượt), mở Bán theo khách hàng.
- Thực thu (tiền đã về trong kỳ), mở Thực thu.
- Công nợ phát sinh trong kỳ, mở Công nợ.

**Hàng 2**:
- Xu hướng theo ngày (8 cột): tab Doanh số / Số đơn / Lượt khách, đường kỳ trước nét đứt; bấm một ngày mở Doanh số của ngày đó.
- Cơ cấu doanh số (4 cột): tổng giá bán, giảm giá/khuyến mãi, phí dịch vụ và phụ thu, thuế, trả hàng, ra doanh thu thuần; dạng danh sách có thanh tỉ lệ. Dòng nào Parkviet chưa có dữ liệu thì không hiện.

**Hàng 3**:
- Doanh số theo giờ (6 cột): cột theo giờ, đánh dấu giờ cao điểm; dùng `by_hour` đã có.
- Theo nguồn đơn (6 cột): số đơn, doanh số, phần còn nợ của từng nguồn; dùng `by_source` đã có.

**Hàng 4**: top 5 món/sản phẩm (tab Số lượng / Doanh số), top 5 thu ngân, top 5 khách hàng (4 cột mỗi khối).

**Hàng 5**:
- Thực thu theo phương thức thanh toán (6 cột): tiền mặt, chuyển khoản, thẻ, ví, ghi nợ.
- Tỷ lệ đơn theo trạng thái (6 cột): chỉ các trạng thái đang có.

**Khối theo module** (chỉ hiện khi chi nhánh bật): lãi món cao nhất/thấp nhất (công thức), đơn bán offline, đối soát sàn chưa khớp, suất ăn căng tin.

**Dữ liệu**: dùng endpoint `/pos/overview` của kế hoạch trang chủ, bổ sung `breakdown` (cơ cấu doanh số), `by_payment_method` (từ truy vấn của `receipts`), `top_cashiers`, `top_customers`. Thực thu và công nợ dùng chung truy vấn của `receipts` và `receivables` để số khớp với báo cáo con.

**Trạng thái**: mỗi khối tự có tải, lỗi, rỗng; chưa chọn chi nhánh thì hiện gợi ý như các trang khác.

## Giá vốn: bình quân gia quyền di động

Hiện trạng (đã đọc mã):
- `spree_variants.cost_price` là giá vốn duy nhất đang được dùng, nhập tay, tính theo đơn vị giá bán. `Spree::Pos::Recipes.unit_cost` đổi nó sang đơn vị tồn kho để tính giá vốn công thức.
- Lúc bán, giá vốn công thức được chụp vào `spree_pos_recipe_consumptions.unit_cost`, nên đơn cũ không đổi giá vốn khi giá trung bình thay đổi.
- Nhập hàng theo đơn mua (`spree_purchase_order_items.unit_cost`) đã ghi `unit_cost` lên `spree_stock_movements`. Ghi chú của Spree nói cột này dùng để tính bình quân sau này, nhưng chưa có mã nào tính. Đơn mua và nhận hàng nằm trong gem Spree, không có ở `server/app`.

Cách làm:
- Mỗi lần **nhận hàng có giá** (dòng `stock_movement` loại nhập có `unit_cost`), tính lại: giá mới = (tồn hiện tại x giá hiện tại + số nhập x giá nhập) / (tồn hiện tại + số nhập), rồi ghi vào `cost_price` của biến thể (đổi đúng đơn vị như `Recipes.unit_cost`). Lãi món, giá vốn công thức và các báo cáo không phải đổi vì vẫn đọc `cost_price`.
- Lưu **lịch sử giá vốn** (bảng nhỏ: biến thể, thời điểm, giá cũ, giá mới, số tồn, nguồn), để báo cáo Nhập xuất tồn tính được giá trị đầu kỳ, cuối kỳ và để tra lại khi số lạ.
- **Giá vốn dòng bán**: chụp `cost_price` lúc bán vào dòng hàng (Spree có cột `spree_line_items.cost_price`; cần kiểm tra Spree đã tự chép chưa). Lợi nhuận tổng lấy từ giá đã chụp này, không lấy giá hiện tại.
- Hook vào luồng nhận hàng bằng sự kiện hoặc callback của Spree, theo hướng dẫn `docs/developer/customization` (không sửa gem). Cần dự án đã `eject`.

Trường hợp biên phải xử lý:
- **Tồn âm hoặc bằng 0** trước khi nhập: lấy luôn giá nhập làm giá mới, không chia cho số âm.
- **Nhập không có giá** (điều chỉnh tay, kiểm kho tăng): không đổi giá trung bình.
- **Trả hàng nhập, chuyển kho giữa chi nhánh, trả hàng bán**: giữ nguyên giá trung bình (hàng đi vào và ra theo đúng giá đang có).
- **Phạm vi**: một giá trung bình cho cả cửa hàng (vì `cost_price` nằm trên biến thể), không tách theo chi nhánh. Nếu sau này cần giá vốn riêng từng kho thì đó là thay đổi lớn hơn.
- **Hàng chưa từng nhập có giá**: giữ `cost_price` nhập tay; báo cáo đánh dấu "chưa có giá vốn" như `menu_margin` đang làm (`costed: false`).
- **Đơn vị**: đơn mua có thể nhập theo thùng, két; phải đổi về đơn vị tồn kho trước khi tính.

Kiểm thử rspec: hai lần nhập giá khác nhau, nhập khi tồn âm, nhập không giá, trả hàng nhập, đổi đơn vị, đơn đã bán trước khi giá đổi vẫn giữ giá cũ.

## Giao diện

- Mỗi mục con là một trang riêng, dùng lại khung `ReportsPage` (tiêu đề, bộ chọn chi nhánh, bộ lọc ngày, bảng, xuất). Bỏ `PillTabs` ở đầu trang; nếu trong một báo cáo có nhiều phần (ví dụ Doanh số: đơn / trả hàng) thì dùng tab con trong trang.
- Bộ lọc ngày và "so với kỳ trước" dùng chung một thanh lọc, mang theo khi chuyển giữa các mục con (đã có ở `carried`).
- Trang Tổng quan và các báo cáo tổng hợp có thẻ số, biểu đồ `recharts` dùng chung bộ biểu đồ với trang chủ widget; bảng chi tiết bên dưới.
- Lịch sử xuất là trang riêng, thay khối `ReportExports` ở cuối mỗi trang bằng nút "Xuất" ở thanh trên và liên kết tới Lịch sử xuất.
- Đường dẫn cũ (`/reports/receipts`, ...) giữ nguyên. `/reports` thành Tổng quan; Doanh số có đường dẫn mới `/reports/sales`, nên link và e2e đang trỏ `/reports` cho Doanh số phải đổi theo. Nếu `/reports` được mở kèm bộ lọc riêng của Doanh số (`section`, `orderSource`) thì chuyển hướng sang `/reports/sales`.

## Các giai đoạn

1. **Menu con (không đổi nội dung báo cáo).** Chuyển lá `reports` trong `nav.ts` thành nhóm có con theo bảng trên, bỏ `PillTabs`, thêm khoá trang cho từng báo cáo vào `pos-access.ts` (`visibleNav`), i18n `vi`/`en`, giữ nguyên đường dẫn cũ. Kiểm: e2e báo cáo hiện có, quyền và module ẩn/hiện đúng.
2. **Trang Lịch sử xuất và thanh lọc dùng chung** (bộ lọc ngày + so với kỳ trước), tách `ReportExports` thành trang.
3. **Báo cáo tổng hợp bán hàng mới** (theo sản phẩm, nhóm hàng, nhân viên, khách hàng, nguồn đơn): máy chủ + rspec + trang. Thêm khoá lọc mới vào `reportSearchSchema` để widget trang chủ drill-down được.
4. **Trang Tổng quan báo cáo (thiết kế mới)**, dùng chung endpoint `/pos/overview` và bộ widget của trang chủ; `/reports` trỏ về đây, Doanh số sang `/reports/sales`.
5. **Giá vốn bình quân gia quyền di động** (máy chủ, xem mục Giá vốn), rồi **báo cáo Kho** (Tồn kho, Nhập xuất tồn): máy chủ + trang.
6. **Thu chi và Lợi nhuận tổng**: chỉ làm sau khi có phiếu thu chi tự do và nguồn giá vốn (phụ thuộc ngoài kế hoạch này).
7. **Hoàn thiện**: e2e theo `AGENTS.md` (desktop, tablet, mobile), cập nhật `apps/pos-dashboard/AGENTS.md`.

Phụ thuộc: 1 và 2 độc lập, làm trước. 3 → 4. 5 độc lập. 6 chờ điều kiện ngoài. Trang chủ widget giai đoạn 4 cần 3 để drill-down.

## Rủi ro

- Đường dẫn và bộ lọc cũ phải tương thích: nhiều link và e2e đang dựa vào `/reports/...` và các khoá `reportSearchSchema`.
- Báo cáo theo sản phẩm trên bảng dòng hàng lớn: cần chỉ mục theo `business_date`, chi nhánh và có thể phải giới hạn khoảng ngày tối đa.
- Số của báo cáo mới phải khớp với `sales` cùng kỳ; dùng chung truy vấn gốc, không viết truy vấn thứ hai.
- Báo cáo có giá vốn dễ gây hiểu lầm nếu thiếu giá vốn: hiển thị `costed: false` như `menu_margin` đang làm.
- Bình quân chỉ đúng từ lúc bắt đầu tính: hàng tồn từ trước vẫn mang giá nhập tay cho tới lần nhập kế tiếp. Ghi rõ ngày bắt đầu trong ghi chú phát hành.
- Đổi `cost_price` tự động có thể bất ngờ với người đang sửa tay giá vốn: màn sản phẩm cần ghi "giá vốn tự cập nhật khi nhập hàng".
- Phạm vi: Thu chi và Lợi nhuận tổng kéo theo tính năng kế toán, không nên ôm vào cùng đợt.

## Tiêu chí hoàn thành

- Sidebar "Báo cáo" có các mục con theo nhóm, mỗi mục có đường dẫn riêng; mục ẩn theo module và quyền như trước.
- Đường dẫn cũ vẫn mở đúng báo cáo; bộ lọc ngày được mang theo giữa các mục.
- Có ít nhất: Tổng quan, bán theo sản phẩm / nhân viên / khách hàng, Tồn kho, Nhập xuất tồn, Lịch sử xuất.
- Số của báo cáo mới khớp `sales` cùng kỳ; typecheck, lint, test, build và e2e liên quan qua; mọi chuỗi có `vi` và `en`.

## Câu hỏi mở

1. Màn sửa sản phẩm có còn cho sửa tay `cost_price` không, khi giá đã tự tính theo bình quân? (khuyến nghị: vẫn cho sửa, ghi vào lịch sử giá vốn với nguồn "sửa tay").
