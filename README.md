# Phiếu đánh giá thực hành lái xe

Ứng dụng React + TypeScript dành cho giáo viên hướng dẫn lái xe, sử dụng Firebase Firestore để đồng bộ danh mục và phiếu đánh giá.

- Trang đầu chọn tên giáo viên từ danh sách do admin quản lý. Giáo viên được chọn mọi hạng xe và không cần nhập lại tên ở phần thông tin học viên.
- Admin thêm, sửa, xóa giáo viên và xe đào tạo. Danh sách biển số xe được chia theo BSS, BTĐ, C1 và cập nhật theo thời gian thực.
- Sau khi chọn hạng xe, giáo viên chọn biển số của đúng hạng; biển số không bắt buộc khi chưa có xe trong danh mục.
- Lần tập dùng danh sách từ 1 đến 10 cho mọi hạng và loại phiếu.

- Chọn hạng B số sàn, B số tự động hoặc C1.
- Sau khi chọn hạng xe, chọn nội dung **Tập cơ bản**, **Sa hình** hoặc **Đường trường**.
- Tập cơ bản dùng phiếu tích nhanh 16 nội dung với các mức **Đã hiểu / Cần lưu ý / Chưa rõ**.
- Đường trường dùng phiếu tích nhanh 11 nội dung với các mức **Tốt / Khá / Trung bình / Yếu**.
- Toàn bộ ứng dụng sử dụng thương hiệu **Trung tâm Giáo dục Nghề nghiệp Phú Giáo**; phiếu cơ bản và đường trường lấy màu xanh làm chủ đạo.
- Đánh giá đúng số bài theo từng hạng: BSS/BTĐ có 11 bài, C1 có 10 bài và không có ghép xe ngang.
- Hiển thị tiêu chí và lỗi riêng theo từng hạng xe.
- Đánh giá tình huống khẩn cấp, ghi chú từng bài và nhận xét nhanh.
- Tự tổng hợp kết quả, đề xuất kết luận và cho phép giáo viên điều chỉnh.
- Nút **Tải PNG** luôn có trên Android, iOS và máy tính. Khi trình duyệt trong ứng dụng chặn tải tự động, dùng **Tải lại PNG**, **Mở ảnh để lưu** hoặc nhấn giữ ảnh trong phần lưu thủ công.
- Xuất PNG từ mẫu 1080 × 1920 px, thử độ nét 2,5 lần và tự giảm khi thiết bị không dựng được ảnh lớn. Không chặn theo tên thiết bị.
- Trình duyệt hỗ trợ chia sẻ tệp có thêm **Chia sẻ / Lưu Ảnh**: lần chạm đầu chuẩn bị ảnh, lần tiếp theo mở bảng chia sẻ để giữ quyền thao tác người dùng. Tùy trình duyệt/hệ điều hành, có thể chọn lưu ảnh hoặc gửi sang ứng dụng khác.
- Không có máy chủ riêng, không lưu bản nháp bằng localStorage. Phiếu được gửi lên Firestore khi bấm **Xem phiếu đánh giá**.

## Danh mục và Firebase

Trang quản trị giữ đường dẫn `/admin/giaovien/A@7979`. Mục **Danh mục giáo viên & xe** nằm phía trên phần thống kê phiếu.

Danh mục mới dùng hai collection:

| Collection | Nội dung |
| --- | --- |
| `trainingTeachers` | `name`, `normalizedName`, `createdAt`, `updatedAt` |
| `trainingVehicles` | `plateNumber`, `normalizedPlate`, `vehicleCategory`, `createdAt`, `updatedAt` |

`vehicleCategory` nhận `B_MANUAL`, `B_AUTOMATIC`, `C1`. Xóa hoặc sửa danh mục không thay đổi các phiếu đã lưu trong collection `evaluations`.

Firestore Rules của dự án cần cho phép đọc hai danh mục từ luồng tạo phiếu và cho phép tài khoản/cơ chế quản trị của dự án thêm, sửa, xóa các mục. Nếu Rules hiện chỉ bao phủ `evaluations`, cần bổ sung quyền cho hai collection mới. Giao diện hiển thị lỗi riêng khi thiếu quyền; mã nguồn không tự mở quyền Firestore. Cơ chế truy cập trang admin hiện có được giữ nguyên, chưa bổ sung hệ thống đăng nhập hoặc phân quyền mới.

## Chạy ứng dụng

```bash
npm ci
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (thông thường là `http://localhost:5173`).

Thiết lập Firebase trong `.env.local` hoặc biến môi trường của dịch vụ hosting: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`; có thể thêm `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID` theo cấu hình dự án.

## Kiểm tra

```bash
npm run lint
npm run build
```

Chạy E2E bằng hai terminal:

```bash
# Terminal 1: server dùng kho dữ liệu thử trong bộ nhớ
npm run test:server

# Terminal 2
npm run test:e2e
```

E2E cần Google Chrome tại đường dẫn cài đặt mặc định trên Windows. Cấu hình thử thay các store Firebase bằng mock, chặn yêu cầu ra ngoài và dừng nếu server không mang dấu hiệu mock; không dùng server production để chạy E2E. Ảnh kiểm tra được ghi vào `artifacts/e2e/`. Bộ kiểm tra bao gồm danh mục, lọc xe theo hạng, lần tập 1–10, ba loại phiếu và các nhánh tải/chia sẻ ảnh trên trình duyệt giả lập Android. Đây không phải kiểm tra trên mọi thiết bị vật lý.

## Triển khai trên Render

Dự án đã có sẵn Blueprint tại `render.yaml` cho Render Static Site:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Rewrite: `/*` → `/index.html` để URL gốc và các đường dẫn của ứng dụng luôn hoạt động.

Đẩy mã nguồn lên GitHub/GitLab/Bitbucket, sau đó tạo Blueprint trong Render từ repository đó. Render sẽ tự đọc cấu hình và triển khai site lên CDN.
