import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { StartupError } from './components/StartupError'
import './styles.css'
import './styles/session-selection.css'
import './styles/report-layout-fixes.css'
import './styles/startup.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<main className="startup-screen" role="status">Đang mở phiếu đánh giá…</main>)

// Firebase được kiểm tra khi nạp App. Bắt lỗi tại đây để cấu hình thiếu
// hoặc lỗi tải module không làm trang trắng trước lần render đầu tiên.
import('./App').then(({ default: App }) => {
  root.render(<React.StrictMode><App /></React.StrictMode>)
}).catch((error: unknown) => {
  root.render(<StartupError error={error} />)
})
