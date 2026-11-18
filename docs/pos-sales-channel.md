# Kênh bán hàng POS

## Thiết lập vận hành

POS dùng kênh có **mã `pos` thuộc cửa hàng hiện tại**. Không dùng tên hiển thị để nhận diện kênh, không tự chuyển sang Online hoặc Wholesale nếu cấu hình thiếu.

Cách nhanh nhất là tạo sản phẩm từ nhóm **Hàng hoá** của app quản trị POS:

1. Lần lưu sản phẩm đầu tiên, app tìm kênh mã `pos` của cửa hàng. Nếu chưa có, app **tự tạo** kênh “Point of Sale” mã `pos`, đang hoạt động và không đặt làm kênh mặc định. Tạo kênh cần quyền ghi Cài đặt (`write_settings`); người không có quyền này nhận thông báo nhờ quản trị tạo kênh.
2. Sản phẩm tạo từ màn Hàng hoá được xuất bản lên kênh `pos` (nguyên liệu thì không) và cấp cho các chi nhánh đã chọn.
3. Nếu kênh `pos` có sẵn nhưng đang tắt, app không tự bật lại; sản phẩm vẫn được lưu và màn hình báo kênh đang tắt.

Có thể làm thủ công trong Spree Dashboard:

1. Chọn đúng cửa hàng và mở **Settings → Sales channels**.
2. Tạo kênh với mã `pos` và bật hoạt động. Tên hiển thị có thể là “Point of Sale”.
3. Xuất bản những sản phẩm muốn bán tại quầy lên kênh này. Kiểm tra lịch bắt đầu và kết thúc xuất bản nếu có.
4. Trong app quản trị POS, mở **Hàng bán tại chi nhánh** và cấp sản phẩm cho từng chi nhánh.
5. Quay lại POS hoặc tải lại trang để cập nhật trạng thái cấu hình.

Ứng dụng không tự xuất bản sản phẩm cũ hay toàn bộ danh mục và không thay đổi dữ liệu cũ; chỉ sản phẩm tạo từ màn Hàng hoá được xuất bản lên kênh `pos`. Một sản phẩm phải đồng thời đang được xuất bản trên kênh POS, còn được phép bán và được cấp cho chi nhánh mới bán được. Tồn kho vẫn lấy từ kho của chi nhánh.

## Giá và khuyến mại

Danh mục, tem cân và thêm hàng dùng bộ giải giá theo ngữ cảnh của Spree, bao gồm kênh POS, thay vì chỉ lấy giá cơ sở. Khi có đơn, ngữ cảnh giá lấy từ chính đơn đó. Các quy tắc khuyến mại theo kênh kiểm tra kênh trên đơn; không cần giả lập Store API bằng header `X-Spree-Channel`.

Giá cơ sở vẫn là giá dự phòng theo quy tắc chuẩn của Spree khi không có bảng giá phù hợp. Có thể cấu hình catalog mặc định của kênh và bảng giá của catalog trong Spree. Những chính sách không giới hạn theo kênh vẫn áp dụng theo hành vi chuẩn của Spree.

Bảng giá được quản lý ở POS dashboard, mục Hàng hoá > Bảng giá (`/goods/price-lists`), và là bảng giá Spree thật:

- Bảng giá cho mọi khách có quy tắc kênh (`channel_rule`), mặc định là kênh `pos`; bỏ hết kênh thì bảng giá áp dụng trên mọi kênh. Ngày bắt đầu và kết thúc tính theo giờ của cửa hàng; bảng giá ngoài khoảng ngày không được dùng.
- Giá sỉ là bảng giá có quy tắc số lượng (`volume_rule`) và các bậc giá theo `min_quantity` của từng biến thể. Ở quầy, mỗi dòng hàng bán theo đơn vị gốc được định giá theo số lượng của chính dòng đó: lúc thêm hàng, khi gộp thêm vào dòng cũ và khi sửa số lượng. Dòng có giá đã đổi tay, dòng thực đơn, hàng cân hoặc bán theo đơn vị quy đổi, dòng từ tem cân và dòng do máy chủ đặt giá không bị định giá lại. Bán offline vẫn dùng giá một đơn vị trong danh mục đã tải.
- Bảng giá cho nhóm khách là bảng giá của một catalog Spree gán cho các nhóm khách đó (catalog mang `metadata.pos_price_list = true`). Catalog không hỏi quy tắc kênh, nên bảng giá này áp dụng cho khách thuộc nhóm trên mọi kênh. Ở quầy, giá tính lúc thêm hàng, nên cần chọn khách trước khi thêm hàng.
- Spree không có trường mã cho bảng giá, nên mã bảng giá (tự sinh dạng `BG` và sáu chữ số) nằm ở `description`. "Giá theo công thức" chỉ tính giá từ giá bán rồi ghi vào bảng giá; công thức không được lưu lại.

Giá đã ghi trên dòng hàng không bị đổi hàng loạt bởi thay đổi cấu hình kênh. Snapshot đã khóa bởi khoản thu được giữ nguyên; hệ thống không định giá lại giao dịch đã bắt đầu thanh toán.

## Khi thiếu hoặc tắt kênh

POS và app quản trị hiển thị hướng dẫn cấu hình bằng tiếng Việt/Anh. Backend từ chối tạo nháp mới, thêm hàng và tăng số lượng; không chỉ ẩn sản phẩm ở giao diện. Mã vạch thường, mã tem cân và ID sản phẩm gửi trực tiếp đều chịu kiểm tra phía máy chủ.

Có thể tiếp tục xem lịch sử, mở ca, giảm số lượng, gỡ hàng hoặc hủy nháp chưa thu tiền. Nháp có khoản thu đã chuẩn bị, chưa rõ kết quả hoặc đã xác nhận vẫn được tiếp tục xử lý và hoàn tất theo các kiểm tra thanh toán hiện hữu. Việc chuẩn bị khoản thu khóa báo giá nhưng không đồng nghĩa đã nhận tiền.

Nếu sản phẩm bị gỡ xuất bản trước khoản thu đầu tiên, phải gỡ sản phẩm khỏi đơn trước khi bắt đầu thanh toán. Việc phân bổ tiền không liên quan vào một nháp chưa cam kết cũng phải qua kiểm tra kênh; tiền đến muộn của chính giao dịch đó vẫn có đường xử lý.

## Đơn nháp và lịch sử trước thay đổi

Đơn POS tạo mới được gắn kênh `pos` bởi backend. Client không được chọn kênh tùy ý. Những đơn/nháp cũ giữ nguyên kênh gốc, kể cả khi từng được gắn Online.

Không thể thêm hàng hoặc tăng số lượng cho nháp cũ thuộc kênh khác; hãy tạo nháp POS mới. Vẫn có thể hủy nháp cũ chưa thu tiền hoặc xử lý tiếp khoản thu đã bắt đầu. Sửa nguồn của đơn lịch sử là một công việc dữ liệu riêng, không nằm trong tích hợp này.

## Giới hạn phạm vi

Thay đổi này không thêm lựa chọn cửa hàng trên màn bán hàng và không bật multi-store/multi-tenant. App quản trị POS tiếp tục dùng cửa hàng trong route của Spree; màn bán hàng tiếp tục dùng cơ chế chọn cửa hàng hiện có của API.
