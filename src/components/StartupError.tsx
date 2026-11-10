import { RefreshCw } from 'lucide-react'
import { TrainingCenterBrand } from './TrainingCenterBrand'

export function StartupError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Không tải được ứng dụng.'
  const missingFirebase = message.startsWith('Thiếu cấu hình Firebase:')
  const demoUrl = new URL(window.location.href)
  demoUrl.port = '4173'
  demoUrl.search = ''
  demoUrl.hash = ''

  return (
    <main className="startup-screen">
      <section className="startup-card" role="alert">
        <TrainingCenterBrand />
        <h1>{missingFirebase ? 'Chưa thiết lập Firebase' : 'Chưa thể mở ứng dụng'}</h1>
        {missingFirebase ? <>
          <p>Bản chạy hiện tại chưa có cấu hình kết nối dữ liệu. Tạo file <code>.env.local</code> trong thư mục <code>phieudanhgia</code>, điền cấu hình Firebase của dự án rồi khởi động lại lệnh chạy.</p>
          <p>Các biến cần có:</p>
          <ul>
            <li><code>VITE_FIREBASE_API_KEY</code></li>
            <li><code>VITE_FIREBASE_AUTH_DOMAIN</code></li>
            <li><code>VITE_FIREBASE_PROJECT_ID</code></li>
            <li><code>VITE_FIREBASE_APP_ID</code></li>
          </ul>
        </> : <p>Không tải được mã ứng dụng. Hãy tải lại trang; nếu lỗi vẫn còn, kiểm tra kết nối và cửa sổ lệnh đang chạy.</p>}
        <button className="button button--outline" type="button" onClick={() => window.location.reload()}><RefreshCw size={17} /> Tải lại trang</button>
        {import.meta.env.DEV && <div className="startup-demo">
          <h2>Thử giao diện bằng dữ liệu mẫu</h2>
          <p>Mở thêm một cửa sổ PowerShell tại thư mục dự án và chạy:</p>
          <pre><code>npm.cmd run test:server</code></pre>
          <a className="button button--primary" href={demoUrl.href}>Mở bản dùng thử</a>
          <p className="startup-demo__note">Bản dùng thử chạy ở cổng 4173, không cần Firebase. Dữ liệu mẫu chỉ phục vụ kiểm tra và không được lưu vào hệ thống thật.</p>
        </div>}
      </section>
    </main>
  )
}
