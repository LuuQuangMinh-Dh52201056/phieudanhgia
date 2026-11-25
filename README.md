# Phú Giáo · Đánh giá thực hành lái xe

Ứng dụng React + TypeScript + Firebase dành cho giáo viên và bộ phận quản trị Trung tâm Giáo dục Nghề nghiệp Phú Giáo.

## Giao diện và nghiệp vụ

- Giao diện mới xanh Phú Giáo, hỗ trợ máy tính và điện thoại từ 320 px.
- Giáo viên chọn hạng xe và nội dung tập, nhập thông tin học viên, đánh giá rồi xem trước phiếu. Bấm **Lưu phiếu đánh giá** để chốt nội dung tại trung tâm và mở thao tác lưu ảnh.
- Giáo viên chọn tên từ danh mục chung. Xe được lọc đúng BSS, BTĐ, C1. Lần tập chọn từ 1 đến 10.
- Cơ bản có 16 mục; đường trường có 11 mục. Sa hình B có 11 bài, C1 có 10 bài; tình huống khẩn cấp đánh giá riêng.
- Admin có dashboard, tìm kiếm/lọc, nhóm theo giáo viên, sửa nội dung và kết quả trên phiếu đã lưu, xuất CSV và dựng lại ảnh.
- Xóa phiếu, giáo viên và xe dùng hộp xác nhận trong trang, có trạng thái chờ, lỗi và thử lại. Chỉ báo thành công sau khi Firebase xác nhận; danh sách cập nhật theo thời gian thực.
- Firebase lỗi quyền hoặc mất mạng được hiển thị rõ. Thao tác ghi/xóa có thời gian chờ hữu hạn; nếu mất kết nối sau khi gửi, yêu cầu vẫn có thể hoàn tất sau đó nên cần tải lại danh sách trước khi gửi lại.
- Trên iPhone và Android, trang chuẩn bị ảnh ngay sau khi lưu phiếu. Nút lưu ảnh mở bảng chia sẻ của máy để chọn **Lưu hình ảnh** hoặc ứng dụng ảnh được thiết bị cung cấp. Khi trình duyệt thiếu chia sẻ tệp, trang mở ảnh để nhấn giữ. Máy tính có nút tải PNG. Khi ảnh lớn không dựng được, ứng dụng thử độ phân giải thấp hơn.

## Chạy nhanh bằng dữ liệu mẫu

```powershell
npm ci
npm run test:server
```

- Trang tạo phiếu: http://127.0.0.1:4173/
- Trang quản trị: http://127.0.0.1:4173/admin/giaovien/A@7979

Server này dùng dữ liệu thử trong bộ nhớ và không gọi Firebase thật. Các thay đổi mẫu mất khi tải lại trang. Tài khoản quản trị giả của bộ thử không phải tài khoản trên hệ thống thật.

## Chạy với Firebase thật

Sao chép `.env.example` thành `.env.local`, điền cấu hình của Firebase project rồi chạy:

```powershell
npm run dev
```

Mở địa chỉ terminal hiển thị, thường là http://localhost:5173. Nếu thiếu cấu hình, ứng dụng hiện hướng dẫn thay vì màn hình trắng.

Các biến bắt buộc gồm `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` và `VITE_FIREBASE_APP_ID`. Khi build với project `webdanhgia-3417e`, Vite lấy UID từ `firebase/firestore.rules` nếu `VITE_FIREBASE_ADMIN_UIDS` trống hoặc chứa giá trị mẫu. Với project Firebase khác, đặt biến này bằng danh sách UID quản trị, phân cách bằng dấu phẩy. Mật khẩu chỉ nhập trên form đăng nhập.

## Thiết lập quyền sửa và xóa trên Firebase

Đọc hướng dẫn đầy đủ tại [firebase/README.md](firebase/README.md). Các bước chính:

1. Bật Email/Password trong Firebase Authentication và tạo/chọn tài khoản quản trị.
2. Điền UID vào danh sách `adminUids` trong [firebase/firestore.rules](firebase/firestore.rules). Nếu Render có biến `VITE_FIREBASE_ADMIN_UIDS`, đặt biến này theo cùng danh sách.
3. Publish toàn bộ Rules mới trong Firestore Database → Rules.
4. Trên dịch vụ Render của website, chọn **Manual Deploy → Deploy latest commit**. Nếu vừa đổi biến môi trường, chọn **Save, rebuild, and deploy** để Vite đọc biến trong lần build mới.
5. Đăng nhập admin và kiểm tra sửa, xóa phiếu, giáo viên và xe bằng dữ liệu thử.

Danh sách UID cho project `webdanhgia-3417e` đã được khai báo trong `firebase/firestore.rules` và `render.yaml`. Nếu dịch vụ Render được tạo ngoài Blueprint, bản build vẫn lấy danh sách từ Rules trong Git khi biến UID bị thiếu. Firebase áp dụng quyền dữ liệu sau khi Publish Rules trên Console.

Danh mục giáo viên và xe hỗ trợ luồng lập phiếu của giáo viên chưa đăng nhập. Quyền ghi danh mục và đọc, sửa, xóa phiếu thuộc tài khoản quản trị. Quản trị viên có thể sửa thông tin buổi tập, mức đánh giá, lỗi, ghi chú và kết quả chung trên bản ghi hiện có. Hạng xe và loại phiếu xác định bộ tiêu chí của bản ghi và được giữ khi sửa.

## Kiểm tra

```powershell
npm run lint
npm run build
```

Với server dữ liệu mẫu đang chạy ở terminal thứ nhất, mở terminal thứ hai:

```powershell
npm run test:e2e
```

E2E dùng Chrome trên Windows và dữ liệu mẫu trong bộ nhớ. Bộ kiểm tra bao gồm đăng nhập, sửa và xóa trong quản trị, chốt kết luận trước khi lưu, ba loại phiếu, xuất PNG và thao tác chia sẻ mô phỏng. Kiểm tra việc lưu vào thư viện ảnh cần thực hiện trên thiết bị thật. Ảnh QA được ghi vào `artifacts/e2e/`.

Kiểm tra quyền bằng Firestore Emulator thật, yêu cầu Java 21 trở lên:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:DEBUG = ''
npm run test:rules
```

Test chỉ chạy project `demo-phieu-danh-gia` tại localhost. Không sử dụng project hoặc dữ liệu thật; UID giả chỉ thay trong bộ nhớ của test. Kiểm tra cả xóa khi SDK mất mạng, hết thời gian chờ và kết nối lại.

## Cấu trúc mã nguồn

- `src/App.tsx`: điều phối quy trình và lưu phiếu.
- `src/pages/`: các màn hình tạo phiếu và dashboard quản trị.
- `src/components/`: báo cáo, xác thực, danh mục và hộp xác nhận dùng chung.
- `src/services/`: kết nối Firebase, dữ liệu, quyền và xử lý lỗi/thời gian chờ.
- `src/styles/app.css`: giao diện ứng dụng mới; `src/styles/reports.css`: mẫu in/PNG riêng.
- `firebase/`: Rules triển khai, cấu hình emulator và hướng dẫn.
- `scripts/`: kiểm thử, mock và server thử tách biệt với production.

## Triển khai Render

Giữ cấu hình Static Site trong `render.yaml`:

- Build: `npm ci && npm run build`
- Publish directory: `dist`
- Rewrite: `/*` → `/index.html`

Thiết lập đủ biến môi trường Firebase và UID admin trên Render. Sau khi Publish Rules và redeploy, kiểm tra bằng tài khoản admin thật; các bài test local không tự thay đổi cấu hình cloud.
