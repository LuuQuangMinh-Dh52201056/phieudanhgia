import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUpRight, LockKeyhole, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { TrainingCenterBrand } from './TrainingCenterBrand'
import { signInAdmin, signOutAdmin, subscribeAdminSession } from '../services/adminAuthStore'
import type { AdminSession } from '../types/adminAuth'
import '../styles/admin-auth.css'

interface AdminAuthGateProps {
  children: ReactNode
}

const initialSession: AdminSession = {
  loading: true,
  configured: false,
  user: null,
  isAuthorized: false,
  error: '',
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const [session, setSession] = useState(initialSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'signin' | 'signout' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => subscribeAdminSession(setSession), [])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !session.configured || session.loading) return
    setBusy('signin')
    setError('')
    try {
      await signInAdmin(email, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập. Vui lòng thử lại.')
    } finally {
      setPassword('')
      setBusy(null)
    }
  }

  const signOut = async () => {
    if (busy) return
    setBusy('signout')
    setError('')
    try {
      await signOutAdmin()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.')
    } finally {
      setBusy(null)
    }
  }

  if (session.loading) {
    return <main className="admin-auth-page"><div className="admin-auth-loading" role="status"><ShieldCheck size={30} /><p>Đang kiểm tra phiên đăng nhập...</p></div></main>
  }

  if (session.isAuthorized && session.user) {
    return <>
      <section className="admin-auth-toolbar" aria-label="Phiên quản trị">
        <div><ShieldCheck size={18} /><span>Quản trị viên</span><strong>{session.user.email || 'Tài khoản quản trị'}</strong></div>
        <button type="button" onClick={() => { void signOut() }} disabled={busy !== null}><LogOut size={16} />{busy === 'signout' ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
        {error && <p role="alert">{error}</p>}
      </section>
      {children}
    </>
  }

  const displayError = error || session.error

  return (
    <main className="admin-auth-page">
      <aside className="admin-auth-story" aria-label="Không gian quản trị Phú Giáo">
        <TrainingCenterBrand light />
        <div className="admin-auth-story-copy"><span>PHÚ GIÁO · QUẢN LÝ ĐÀO TẠO</span><h2>Tận tâm hôm nay.<br />Vững tay lái<br /><em>ngày mai.</em></h2><p>Một không gian để đội ngũ kết nối, mỗi buổi học được ghi nhận và mọi tiến bộ được nhìn thấy.</p></div>
        <div className="admin-auth-story-route" aria-hidden="true"><svg viewBox="0 0 580 220" fill="none"><path d="M-30 180H160C245 180 230 38 320 38H610" stroke="currentColor" strokeWidth="64" /><path d="M-30 180H160C245 180 230 38 320 38H610" stroke="#cce49b" strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="10 14" /></svg><span><ShieldCheck size={23} /></span></div>
        <div className="admin-auth-story-footer"><span>AN TOÀN · TRÁCH NHIỆM · VỮNG TAY LÁI</span><ArrowUpRight size={20} /></div>
      </aside>
      <section className="admin-auth-card" aria-label="Xác thực quản trị">
        <div className="admin-auth-mobile-brand"><TrainingCenterBrand compact /></div>
        <div className="admin-auth-icon"><LockKeyhole size={28} /></div>
        <span className="admin-auth-eyebrow">KHU VỰC QUẢN TRỊ</span>
        <h1>{session.configured ? 'Đăng nhập quản trị' : 'Thiết lập tài khoản quản trị'}</h1>
        {session.configured ? <p>Chào mừng trở lại. Đăng nhập để tiếp tục quản lý hoạt động đào tạo của trung tâm.</p> : <p>Ứng dụng chưa được cấu hình UID của tài khoản quản trị.</p>}

        {!session.configured ? (
          <div className="admin-auth-setup">
            <ol>
              <li>Mở Firebase Console → Authentication, bật phương thức Email/Password và tạo hoặc chọn tài khoản quản trị.</li>
              <li>Sao chép UID của tài khoản. Trong Render → Environment, thêm <code>VITE_FIREBASE_ADMIN_UIDS</code> với UID này. Nếu có nhiều tài khoản, phân cách bằng dấu phẩy.</li>
              <li>Thêm cùng UID vào danh sách quản trị trong Firestore Rules của hai danh mục, rồi triển khai lại ứng dụng để áp dụng biến môi trường.</li>
            </ol>
            <p>Mật khẩu được nhập tại trang đăng nhập sau khi cấu hình xong.</p>
            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">Mở Firebase Console</a>
          </div>
        ) : session.user ? (
          <div className="admin-auth-unauthorized">
            <p>Đang đăng nhập với <strong>{session.user.email || 'tài khoản chưa được cấp quyền'}</strong>.</p>
            {displayError && <p className="admin-auth-error" role="alert">{displayError}</p>}
            <button className="admin-auth-submit" type="button" disabled={busy !== null} onClick={() => { void signOut() }}><LogOut size={17} />{busy === 'signout' ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
          </div>
        ) : (
          <form className="admin-auth-form" onSubmit={(event) => { void signIn(event) }}>
            <label htmlFor="admin-auth-email">Email quản trị</label>
            <input id="admin-auth-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy !== null} />
            <label htmlFor="admin-auth-password">Mật khẩu</label>
            <input id="admin-auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy !== null} />
            {displayError && <p className="admin-auth-error" role="alert">{displayError}</p>}
            <button className="admin-auth-submit" type="submit" disabled={busy !== null}><LogIn size={18} />{busy === 'signin' ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
            <span className="admin-auth-form-note"><ShieldCheck size={13} />Dành cho tài khoản được trung tâm cấp quyền</span>
          </form>
        )}
        <a className="admin-auth-home" href="/">← Về trang tạo phiếu</a>
      </section>
    </main>
  )
}
