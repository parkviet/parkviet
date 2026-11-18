# Quản trị ParkViet POS

Ứng dụng quản trị React độc lập, sử dụng Spree dashboard-core/UI **6.0.3**. Ứng dụng
chạy riêng với ứng dụng thu ngân (5175) và Spree Dashboard (5173).

## Phát triển cục bộ

`pnpm spree dev` ở thư mục gốc khởi động app này cùng bảng quản trị và POS, ở
cổng **5176**. Tắt cả POS và app này bằng `SPREE_POS_DEV=0`. Chạy riêng khi cần:

```sh
cd apps/pos-dashboard
pnpm install
pnpm dev
```

Truy cập **http://localhost:5176** và đăng nhập bằng tài khoản nhân viên/quản trị
viên. Cửa hàng đầu tiên mà tài khoản có quyền truy cập sẽ được chọn; dùng bộ chọn
cửa hàng trên thanh bên để chuyển sang cửa hàng khác. Phiên đăng nhập được khôi
phục bằng cookie làm mới HTTP-only của Spree. Để truy cập cấu hình POS, tài khoản
cần có quyền `read_pos_topology` hoặc `write_pos_topology`; quản lý chi nhánh có
quyền `pos.topology.manage` chỉ có thể truy cập phần tính năng và mô hình kinh
doanh của chi nhánh đó.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e --project desktop
```

Các bài kiểm thử E2E nằm trong `e2e/`; Playwright tự khởi động máy chủ trên cổng
cố định 5176 và chạy với 4 worker. Không để máy chủ phát triển khác chiếm cổng
này khi chạy bộ kiểm thử. Các dự án desktop, tablet và mobile đều đã được cấu hình.

Ứng dụng thu ngân (`apps/pos`) không còn các trang cài đặt hoặc thiết lập; menu
người dùng, màn hình đăng nhập và thông báo thiết lập của ứng dụng thu ngân sẽ mở
ứng dụng quản trị này trong thẻ mới.

## Biến môi trường công khai khi build

| Biến | Mặc định | Mục đích |
|---|---|---|
| `VITE_SPREE_API_URL` | Để trống | Origin công khai của API; để trống để dùng `/api` cùng origin |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Đích proxy của Vite cho `/api` và `/rails` khi phát triển |
| `VITE_BASE_PATH` | `/` | Đường dẫn gốc công khai, ví dụ `/pos-admin/`; cần build lại khi thay đổi |
| `VITE_POS_URL` | `http://localhost:5175` khi phát triển; ẩn nút khi bản production không đặt | Địa chỉ ứng dụng thu ngân. Nút POS trên thanh bên mở màn bán hàng của cửa hàng đang xem trong tab mới. Chấp nhận đường dẫn cùng origin, ví dụ `/pos/` |

Mọi giá trị `VITE_*` đều được nhúng vào các tệp gửi đến trình duyệt. **Không bao
giờ đặt API secret, thông tin đăng nhập cơ sở dữ liệu, token nhân viên hoặc khóa
riêng tư trong các biến VITE.**

Chi nhánh được chọn qua `?branch=...&register=...`; các route tài nguyên chi nhánh
cũng chứa `$branchId`. Khóa cache truy vấn có chứa định danh cửa hàng, và quyền
nhân viên được tải lại khi chuyển cửa hàng. Ứng dụng này không thay đổi schema máy
chủ hay mô hình quyền hạn.

## Triển khai production dưới dạng trang tĩnh riêng

Build bằng `pnpm build` và triển khai `dist/` thành một trang tĩnh riêng, tương tự
cách ứng dụng thu ngân được triển khai trên cổng riêng. `pnpm preview` phục vụ bản
build tại cổng cố định **5176**, với cùng proxy `/api` và `/rails` như `pnpm dev`,
đủ để kiểm tra bản build cục bộ. Việc trỏ tên miền tới cổng là công việc hạ tầng;
không có tên miền nào được khai báo trong mã nguồn.

1. Cấu hình `VITE_SPREE_API_URL` và `VITE_BASE_PATH` công khai **trước khi build**.
   Với cấu hình cùng origin được khuyến nghị, để trống URL API và dùng reverse proxy
   chuyển `/api/*` và `/rails/*` tới Rails. Proxy của Vite chỉ dùng khi phát triển.
2. Phục vụ các tệp tĩnh hiện có như bình thường và chuyển các route ứng dụng về
   `index.html` (SPA fallback), bao gồm `/<store>/settings/receipt-templates/<id>`.
   Nếu triển khai dưới một đường dẫn con, hãy phục vụ tệp tĩnh và áp dụng fallback
   bên dưới cùng đường dẫn gốc đó.
3. Sử dụng HTTPS trong production. Nếu API khác origin, cần cấu hình CORS đúng cho
   các yêu cầu có thông tin xác thực và đăng ký chính xác origin của dashboard
   trong Allowed Origins của Spree để `StaffSessionOriginGuard` hoạt động. Cookie
   làm mới trong production dùng `SameSite=None; Secure` nên cần HTTPS; không bỏ
   qua origin guard hoặc chuyển token làm mới vào bộ nhớ trình duyệt.
4. Kiểm tra đăng nhập, tải lại/làm mới trang, đăng xuất, chuyển cửa hàng và quyền
   truy cập với cấu hình proxy/origin production. Kiểm tra cả URL hình ảnh `/rails`.
5. Đặt biến công khai `VITE_POS_DASHBOARD_URL` của bản build ứng dụng thu ngân thành
   URL của trang này (bao gồm đường dẫn gốc), rồi **build và triển khai lại ứng dụng
   thu ngân**. Chỉ thay đổi môi trường trên máy chủ không cập nhật bundle Vite đã
   build; nếu thiếu biến này, bản production của ứng dụng thu ngân sẽ ẩn các liên
   kết đến trang quản trị.

### Danh sách kiểm tra hạ tầng cho tên miền mới

- Trỏ tên miền tới trang tĩnh (cổng 5176 hoặc nơi lưu trữ `dist/`), bật HTTPS và
  cấu hình SPA fallback như trên.
- Thêm chính xác origin vào **Allowed Origins** của cửa hàng trong Spree. Nếu không,
  `StaffSessionOriginGuard` (`server/config/initializers/staff_session_origin.rb`)
  sẽ từ chối yêu cầu làm mới phiên và đăng xuất, khiến người dùng bị đăng xuất mỗi
  khi tải lại trang.
- Đặt `VITE_POS_DASHBOARD_URL` cho bản build ứng dụng thu ngân và triển khai lại.

### Sau khi triển khai

1. Đăng nhập, tải lại trang và xác nhận phiên đăng nhập vẫn còn.
2. Truy cập trực tiếp một liên kết sâu như `/<store>/settings/receipt-templates`;
   trang phải tải được, không trả về lỗi 404.
3. Đăng xuất và xác nhận các URL được bảo vệ chuyển về trang đăng nhập.
4. Từ ứng dụng thu ngân, mở menu người dùng → Cấu hình: dashboard mở trong thẻ mới
   với cùng cửa hàng và chi nhánh.
5. Đăng nhập bằng tài khoản quản lý chi nhánh: chỉ hiển thị phần Tính năng và Mô
   hình kinh doanh.

Đặt tên miền triển khai trong cấu hình môi trường, không đặt trong mã nguồn ứng
dụng. Xem `AGENTS.md` để biết quy ước về mở rộng và API hook.

## Mẫu in phiếu (`/settings/receipt-templates`)

Mỗi cửa hàng có sẵn bộ mẫu gợi ý cho **6 loại chứng từ** (`sale`, `prebill`, `payment_ticket`, `return`, `refund`, `shift_closure`) trên đủ **5 khổ giấy** (`58mm`, `80mm`, `A4`, `A5`, `A6` — mặc định đang dùng là `80mm`, tối đa 10 mẫu đang dùng mỗi loại). Mẫu khổ rộng (`A4`, `A5`) mặc định trình bày dạng bảng kẻ khung kèm ô chữ ký.

### Các mục chỉnh sửa trong Editor

1. **Thông tin mẫu**: tên mẫu và khổ giấy (`58mm`, `80mm`, `A6`, `A5`, `A4`).
2. **Giao diện**: phông chữ, cỡ chữ, giãn dòng, lề 4 phía (`top`, `bottom`, `left`, `right`, `0–15 mm` — để trống thì lấy theo khổ giấy), khoảng đẩy giấy trước khi cắt (`cut_feed_mm`, chỉ trên khổ nhiệt `58mm`/`80mm`) và số liên mỗi lần in (phiếu bán).
3. **Đầu phiếu**: các khối kéo thả được (logo, thông tin cửa hàng gồm cả MST và mô tả, tiêu đề với 3 cỡ Vừa/Lớn/Rất lớn, văn bản chèn biến `{...}`, đường kẻ, khoảng trống, QR, mã vạch).
4. **Thông tin đơn (`meta`)**: chia thành 6 nhóm con theo `SECTION_RULES`:
   - *Đơn hàng*: số đơn, số phiếu trả, số gọi món, kênh bán.
   - *Bàn & khu vực*: bàn/phòng và cách hiện 1 dòng (`Khu vực - Bàn`) hoặc 2 dòng riêng.
   - *Thời gian*: thời gian chứng từ, giờ vào, giờ ra, thời gian phục vụ và định dạng ngày-giờ / chỉ ngày.
   - *Người phục vụ*: thu ngân.
   - *Khách hàng*: tên, SĐT và địa chỉ giao.
   - *Bản in*: ngày in và lượt in.
5. **Dòng hàng (`lines`)**: kiểu trình bày (xếp chồng / bảng), kiểu kẻ bảng (`none`, `rows`, `grid`), các cột (STT, tên hàng, SKU, mã vạch sản phẩm, đơn vị, số lượng, giá gốc gạch ngang, đơn giá, giảm giá, thành tiền, ghi chú dòng), serial/lô/HSD, quy đổi đơn vị và cách in dịch vụ tính giờ (từ giờ đến giờ / tổng thời lượng).
6. **Tổng tiền (`totals`)**: số lượng hàng, tiền hàng, giảm giá, từng khuyến mãi, phí giao hàng, từng khoản phí (phụ thu / phí phục vụ), thuế và tổng cộng (luôn in).
7. **Thanh toán (`payments`)**: phương thức thanh toán, khách đưa, tiền thừa, mã giao dịch, đã thanh toán, còn nợ, công nợ cũ, tổng công nợ, hạn thanh toán, mã QR trả nợ và mã QR chuyển khoản (kèm cỡ QR và 4 vị trí chú thích; cảnh báo nếu cửa hàng chưa khai báo tài khoản nhận VietQR).
8. **Hóa đơn điện tử (`einvoice`, chỉ phiếu bán)**: MST người bán, ký hiệu & số hóa đơn, mã tra cứu, mã CQT, trang tra cứu và mã QR HĐĐT. Khi bật mục này, chân phiếu không tự in trùng QR lấy hóa đơn nữa; khi tắt hết các trường trong mục, phiếu quay về hành vi cũ (tự gắn QR nhập thông tin xuất hóa đơn ở chân phiếu khi đang chờ người mua).
9. **Chân phiếu**: các khối văn bản, đường kẻ, QR mạng xã hội/website, mã vạch số chứng từ và ô chữ ký (chỉ hiện trên khổ A4/A5), theo sau là dòng lưu ý pháp lý cố định.

### Thời điểm đọc dữ liệu & tương thích phiếu cũ

- **Đọc lúc chốt đơn (lưu bất biến trong `ReceiptSnapshot`)**: thông tin cửa hàng/chi nhánh/quầy, bàn & khu vực, giờ vào/ra, kênh bán, dòng hàng (mã vạch, giá gốc, ghi chú), số lượng hàng, từng khuyến mãi, từng khoản phí, công nợ cũ/tổng công nợ của khách và payload VietQR chuyển khoản của đơn.
- **Đọc lúc in (không ghi vào snapshot)**: trạng thái và thông tin hóa đơn điện tử mới nhất (`Einvoices::ReceiptInfo`: MST người bán, ký hiệu, số hóa đơn, mã CQT, mã tra cứu, QR) cùng `printed_at` (ngày giờ in) và `print_count` (lượt in từ `ReceiptPrint` / `PrebillPrint`). Phiếu tạm tính đọc trực tiếp từ đơn đang mở (`PosWorkspace`).
- **Phiếu cũ**: các snapshot lập trước khi có trường mới không bị sửa lại; trường nào không có dữ liệu trong snapshot thì tự động ẩn khi in, và bản xem trước "Phiếu gần nhất" trong editor sẽ hiện thông báo nhắc các trường chưa có trên phiếu cũ đó.


## Tem sản phẩm (`/settings/receipt-templates`, tab Tem sản phẩm)

Mẫu tem được thiết kế ở tab **Tem sản phẩm** của trang Mẫu in và in hàng loạt từ trang **Hàng hoá** của chi nhánh: tick các sản phẩm đang bán ở chi nhánh (chỉ trong trang đang xem), bấm **In tem (n)**, chỉnh số tem từng dòng, chọn mẫu, xem trước rồi in. Hộp thoại (`components/product-label/print-labels-dialog.tsx`) chỉ nhận danh sách `{ variantId, quantity }` nên có thể mở từ chỗ khác. Hiện in qua trình duyệt; mỗi lần in tối đa 200 dòng và 2000 tem.

### Khổ tem và số đo lưới

Số đo nằm trong `packages/pos-shared/src/product-label/presets.ts`, bản sao của `server/config/pos/product_label_presets.json` (test hợp đồng giữ hai bản trùng nhau). Đơn vị mm.

| Khổ | Tem (rộng × cao) | Lưới | Khoảng cách ngang / dọc | Lề tờ (trên, trái) |
|---|---|---|---|---|
| Cuộn 50×30 | 50 × 30 | 1 tem/hàng | 0 / 2 | — |
| Cuộn 40×30 | 40 × 30 | 1 tem/hàng | 0 / 2 | — |
| Cuộn 75×25, 2 tem | 35 × 25 | 2 tem/hàng | 3 / 2 | — |
| Cuộn 72×22, 2 tem | 33 × 22 | 2 tem/hàng | 3 / 2 | — |
| Cuộn 110×22, 3 tem | 33 × 22 | 3 tem/hàng | 2 / 2 | — |
| A4, 100 tem | 38 × 13,5 | 5 × 20 | 2,5 / 0,8 | 6, 5 |
| A4, 65 tem | 38,1 × 21,2 | 5 × 13 | 2,5 / 0 | 10,7, 4,7 |
| A4, 180 tem | 20,5 × 13,5 | 9 × 20 | 1,5 / 0,8 | 6, 6,7 |
| A5, 40 tem | 33,5 × 19 | 4 × 10 | 2 / 0,8 | 6,5, 4 |

Khổ cuộn lấy theo kích thước cuộn tem nhiệt phổ biến. **Số đo các khổ tờ A4/A5, trừ tờ 65 tem (bố cục 38,1 × 21,2 mm thường gặp của giấy decal 65 tem), là số ước tính** theo bố cục decal thông dụng, chưa đối chiếu với thông số của nhà sản xuất. Phải in thử một tờ lên giấy decal thật và chỉnh số đo nếu tem lệch ô trước khi in hàng loạt.

### In tờ decal đúng ô

1. Trong hộp thoại in của trình duyệt chọn đúng khổ giấy (A4 hoặc A5), **tỉ lệ 100%** (không chọn "Vừa trang" / "Fit to page"), lề là **Không** (None) và tắt đầu trang, chân trang.
2. Tem được đặt theo milimét từ lưới của khổ giấy, nên chỉ rơi đúng ô khi tỉ lệ là 100%.
3. In thử trên giấy thường rồi đặt chồng lên tờ decal, đưa ra ánh sáng để kiểm tra các ô khớp nhau trước khi in lên tờ thật.
4. Tờ đã dùng một phần: chọn **ô bắt đầu** (đánh số từ trái sang phải, từng hàng từ trên xuống) để bỏ qua các ô đã bóc; các tờ sau luôn bắt đầu từ ô 1.
5. Cuộn tem nhiệt: mỗi trang là một hàng tem. Qua driver Windows, tạo khổ giấy tuỳ chỉnh đúng kích thước cuộn (ví dụ 50 × 30 mm) trong driver, vì driver thường tự đặt khổ giấy theo cài đặt của nó.

### Giá trên tem

Giá in là giá niêm yết của đơn vị bán đang chọn cho variant, theo **kênh bán POS của chi nhánh** (cùng số tiền quầy thu cho một đơn vị), không nhân thêm hệ số quy đổi. Giá gốc gạch ngang chỉ in khi giá so sánh lớn hơn giá bán. Dòng chưa có giá hiện cảnh báo trong hộp thoại và tem không in giá.

### Mã vạch: EAN-13 hay Code 128

- Mã lấy từ mã vạch của variant; nếu trống thì lấy mã hàng (SKU); nếu cả hai trống, tem không có khối mã vạch và hộp thoại cảnh báo.
- Kiểu **Tự động** (mặc định): mã 13 chữ số có số kiểm tra hợp lệ in **EAN-13**, mọi mã khác in **Code 128**. Kiểu **EAN-13** cũng chỉ in EAN-13 cho mã hợp lệ và dùng Code 128 cho mã còn lại; kiểu **Code 128** luôn in Code 128.
- Mã không vừa chiều rộng tem (vạch mảnh hơn mức máy quét ở quầy đọc được) in dưới dạng dãy số kèm cảnh báo; chọn tem rộng hơn hoặc giảm lề.
