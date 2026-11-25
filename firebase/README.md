# Cấu hình Firebase cho Phú Giáo

Các file trong thư mục này chỉ chuẩn bị cấu hình. Sửa file hoặc triển khai giao diện lên Render **chưa tự Publish Firestore Rules** và chưa thay đổi dữ liệu đang có.

## Quyền truy cập

| Dữ liệu | Chưa đăng nhập / tài khoản thường | UID quản trị được cấp quyền |
| --- | --- | --- |
| `trainingTeachers`, `trainingVehicles` | Đọc danh mục để lập phiếu | Đọc, thêm, sửa, xóa |
| `evaluations` | Tạo phiếu mới hợp lệ | Tạo, đọc, sửa, xóa |
| Collection khác và các đường dẫn con | Từ chối | Từ chối |

Nội dung tạo phiếu kiểm tra tên giáo viên, học viên, hạng xe, loại đánh giá, ngày và hai thời điểm do server cấp. Sửa danh mục giữ nguyên thời điểm tạo nếu có và cập nhật `updatedAt`. Phiếu đã sửa giữ mã, hạng xe, loại phiếu và thời điểm tạo. Firebase xác thực `updatedBy` và `updatedAt` cho lần sửa gần nhất.

Rules mới **đóng quyền đọc/xóa phiếu công khai**. Các phiếu cũ, kể cả danh sách hiện có, giữ nguyên; cập nhật Rules không phải thao tác xóa dữ liệu. Rules đang có trên Firebase vẫn có hiệu lực đến khi bạn Publish bản mới. [Firebase giải thích cơ chế Rules](https://firebase.google.com/docs/firestore/security/get-started).

## Thiết lập tài khoản quản trị

1. Mở đúng Firebase project mà website đang dùng. Trong **Authentication → Sign-in method**, bật **Email/Password**. Trong **Users**, tự tạo tài khoản quản trị bằng email và mật khẩu của bạn; không đưa mật khẩu vào code, Render Environment hoặc Git.
2. Trong **Authentication → Users**, sao chép **User UID** của tài khoản dùng để quản trị. Với project `webdanhgia-3417e`, chuỗi `UID_ADMIN_THAT` trong Rules đang chụp là giá trị mẫu cần thay bằng UID thực.
3. Với project `webdanhgia-3417e`, `firestore.rules` và `render.yaml` đã có UID được cấp cho quản trị viên. Khi đổi hoặc thêm quản trị viên, cập nhật danh sách `let adminUids` và biến `VITE_FIREBASE_ADMIN_UIDS` cùng lúc. Chuỗi bảo vệ `REPLACE_WITH_ADMIN_UID` giúp Rules từ chối cấp quyền cho cấu hình mẫu.
4. Với project `webdanhgia-3417e`, bản build tự lấy các UID từ Rules trong Git nếu `VITE_FIREBASE_ADMIN_UIDS` trống hoặc là giá trị mẫu. Nếu đặt biến này trong Render **Environment** hoặc `.env.local`, dùng cùng danh sách UID thật, phân cách bằng dấu phẩy. Các biến `VITE_FIREBASE_*` phải cùng Firebase project. Mỗi lần đổi cấu hình cần build lại trên Render.
5. Nếu Firebase báo lỗi tên miền đăng nhập, vào **Authentication → Settings → Authorized domains**, thêm tên miền Render/tên miền riêng đang dùng. [Hướng dẫn Email/Password của Firebase](https://firebase.google.com/docs/auth/web/password-auth).
6. Vào **Firestore Database → Rules**, dán **toàn bộ** nội dung `firestore.rules` đã điền UID, kiểm tra rồi nhấn **Publish**. Không dán riêng đoạn danh mục hoặc thêm một `allow read, write: if true` khác: các điều kiện cho phép trùng đường dẫn được kết hợp, nên một đoạn công khai có thể mở lại dữ liệu.
7. Tải lại website và đăng nhập quản trị. Dùng dữ liệu thử để kiểm tra sửa, xóa phiếu, giáo viên và xe. Mở cửa sổ riêng tư để kiểm tra luồng lập và lưu phiếu của giáo viên.

Danh sách UID ở giao diện chỉ điều khiển màn hình. Quyền đọc/ghi thực tế do Firestore Rules xác thực UID của Firebase Authentication quyết định. Không bỏ đăng nhập hoặc mở quyền ghi công khai để xử lý lỗi thiếu quyền.

## Publish bằng CLI nếu bạn tự chọn

Thực hiện từ thư mục gốc dự án, sau khi kiểm tra đúng UID và project:

```powershell
npx firebase login
npx firebase deploy --only firestore:rules --config firebase/firebase.json --project YOUR_FIREBASE_PROJECT_ID
```

`YOUR_FIREBASE_PROJECT_ID` phải được thay bằng project thật của website. Lệnh này chỉ Publish Rules, không triển khai giao diện và không xóa các phiếu. Các bước trong tài liệu không được tác nhân tự chạy trên cloud.

## Kiểm tra Rules tại máy

Yêu cầu Node.js, dependencies của dự án và Java 21 trở lên. Trên máy này có thể dùng Java đi kèm Android Studio:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npx firebase emulators:exec --only firestore --config firebase/firebase.test.json --project demo-phieu-danh-gia "node scripts/rules-tests.mjs"
```

Test dùng project `demo-phieu-danh-gia` và Firestore emulator tại `127.0.0.1:8088`. Script từ chối host ngoài localhost, không dùng project thật; fixture chỉ được xóa trong emulator. UID quản trị giả chỉ thay trong bộ nhớ test, không ghi vào file Rules. Test kiểm tra placeholder, đọc công khai danh mục, cấm toàn bộ ghi của người thường, CRUD quản trị, schema/timestamp, dữ liệu phiếu riêng tư, tạo phiếu không đăng nhập và chặn đường dẫn lồng. Test cũng chạy helper xóa thật của ứng dụng: giữ nguyên mã lỗi Firebase, từ chối ID sai và kết thúc chờ sau 15 giây khi SDK mất mạng; yêu cầu đang chờ được kiểm tra tiếp sau khi kết nối lại. [Hướng dẫn kiểm thử Rules chính thức](https://firebase.google.com/docs/rules/unit-tests).

## Lỗi xóa hoặc lưu

- Khi gặp lỗi quyền, đối chiếu UID của tài khoản đăng nhập với danh sách trong Render và Rules đã Publish. Quyền sửa, xóa cũng áp dụng cho phiếu cũ.
- **Mất mạng:** ứng dụng báo lỗi hữu hạn để không giữ nút ở trạng thái chờ mãi. Nếu mất kết nối sau khi đã gửi yêu cầu, Firebase vẫn có thể hoàn tất ghi/xóa khi mạng trở lại; tải lại danh sách trước khi thử lại.
- **Dữ liệu cũ thiếu thời gian hoặc loại phiếu:** giao diện giữ trạng thái không xác định; không tự gán ngày hiện tại. Loại cũ `COURSE` được hiểu là sa hình (`EXAM`).
