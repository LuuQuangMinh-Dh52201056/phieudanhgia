import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Copy, Laptop, LockKeyhole, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { AdminDashboardLayout, AdminDashboardStats, type AdminView } from './AdminDashboardLayout'
import { signInAdmin, signOutAdmin, startAdminDevice, subscribeAdminSession } from '../services/adminAuthStore'
import type { AdminSession } from '../types/adminAuth'
import { formatDate, getTodayInputValue } from '../utils/evaluation'
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
  const [view, setView] = useState<AdminView>('overview')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [useEmail, setUseEmail] = useState(false)
  const [busy, setBusy] = useState<'signin' | 'signout' | 'device' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

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
    setCopied(false)
    try {
      await signOutAdmin()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.')
    } finally {
      setBusy(null)
    }
  }

  const activateDevice = async () => {
    if (busy || session.user || !session.configured) return
    setBusy('device')
    setError('')
    setCopied(false)
    try {
      await startAdminDevice()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa thể tạo mã thiết bị. Vui lòng thử lại.')
    } finally {
      setBusy(null)
    }
  }

  const copyDeviceUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid)
      setError('')
      setCopied(true)
    } catch {
      setError('Hãy bôi đen mã thiết bị và sao chép thủ công.')
    }
  }

  if (!session.loading && session.isAuthorized && session.user) {
    return <>
      <section className="admin-auth-toolbar" aria-label="Phiên quản trị">
        <div><ShieldCheck size={18} /><span>Quản trị viên</span><strong>{session.user.isAnonymous ? 'Thiết bị đã cấp quyền' : session.user.email || 'Tài khoản quản trị'}</strong></div>
        <button type="button" onClick={() => { void signOut() }} disabled={busy !== null}><LogOut size={16} />{busy === 'signout' ? 'Đang đăng xuất...' : session.user.isAnonymous ? 'Thoát trên thiết bị này' : 'Đăng xuất'}</button>
        {error && <p role="alert">{error}</p>}
      </section>
      <Fragment key={session.user.uid}>{children}</Fragment>
    </>
  }

  const displayError = error || session.error
  const pendingDevice = session.user?.isAnonymous
  const showEmailForm = useEmail && !session.user
  let title = 'Truy cập quản trị'
  if (!session.configured) title = 'Thiết lập tài khoản quản trị'
  else if (pendingDevice) title = 'Thiết bị chờ cấp quyền'
  else if (showEmailForm || session.user) title = 'Đăng nhập quản trị'

  const showEmailSignIn = () => {
    setError('')
    setUseEmail(true)
  }

  return <div className="admin-dashboard">
    <AdminDashboardLayout
      view={view}
      onViewChange={setView}
      status={session.loading ? 'Đang kiểm tra quyền' : 'Chờ cấp quyền'}
      statusAttention={!session.loading}
    >
      {view === 'overview' && <AdminDashboardStats todayLabel={formatDate(getTodayInputValue())} />}
      {session.loading ? <section className="admin-card admin-auth-card" role="status">
        <p>Đang kiểm tra phiên đăng nhập...</p>
      </section> : <section className="admin-card admin-auth-card" aria-label="Xác thực quản trị">
        <header className="admin-auth-card-heading"><span aria-hidden="true"><LockKeyhole size={20} /></span><h2>{title}</h2></header>
        {!session.configured && <p>Ứng dụng chưa được cấu hình UID của tài khoản quản trị.</p>}
        {session.configured && !session.user && !showEmailForm && <p>Dùng thiết bị đã cấp quyền để xem và chỉnh sửa dữ liệu đào tạo.</p>}

        {!session.configured ? (
          <div className="admin-auth-setup">
            <ol>
              <li>Mở Firebase Console → Authentication, bật phương thức Email/Password và tạo hoặc chọn tài khoản quản trị.</li>
              <li>Thêm UID vào danh sách quản trị trong Firestore Rules. Với dự án Firebase riêng, đặt cùng UID trong <code>VITE_FIREBASE_ADMIN_UIDS</code> ở Render → Environment.</li>
              <li>Publish Firestore Rules, rồi chọn <strong>Save, rebuild, and deploy</strong> trong Render để tạo bản web mới.</li>
            </ol>
            <p>Mật khẩu được nhập tại trang đăng nhập sau khi cấu hình xong.</p>
            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">Mở Firebase Console</a>
          </div>
        ) : pendingDevice && session.user ? (
          <div className="admin-auth-device">
            <p>Gửi mã thiết bị này để được cấp quyền. Giữ dữ liệu trang web trên trình duyệt để dùng lại mã.</p>
            <div className="admin-auth-device-code">
              <code data-testid="admin-device-uid">{session.user.uid}</code>
              <button className="admin-auth-secondary" type="button" onClick={() => { if (session.user) void copyDeviceUid(session.user.uid) }}>
                <Copy size={16} /> Sao chép mã
              </button>
            </div>
            {copied && <p className="admin-auth-device-status" role="status">Đã sao chép mã thiết bị.</p>}
            {displayError && <p className="admin-auth-error" role="alert">{displayError}</p>}
            <button className="admin-auth-option" type="button" disabled={busy !== null} onClick={() => { showEmailSignIn(); void signOut() }}>Dùng tài khoản quản trị</button>
          </div>
        ) : session.user ? (
          <div className="admin-auth-unauthorized">
            <p>Đang đăng nhập với <strong>{session.user.email || 'tài khoản chưa được cấp quyền'}</strong>.</p>
            {displayError && <p className="admin-auth-error" role="alert">{displayError}</p>}
            <button className="admin-auth-submit" type="button" disabled={busy !== null} onClick={() => { void signOut() }}><LogOut size={17} />{busy === 'signout' ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
          </div>
        ) : showEmailForm ? (
          <form className="admin-auth-form" onSubmit={(event) => { void signIn(event) }}>
            <label htmlFor="admin-auth-email">Email quản trị</label>
            <input id="admin-auth-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy !== null} />
            <label htmlFor="admin-auth-password">Mật khẩu</label>
            <input id="admin-auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy !== null} />
            {displayError && <p className="admin-auth-error" role="alert">{displayError}</p>}
            <button className="admin-auth-submit" type="submit" disabled={busy !== null}><LogIn size={18} />{busy === 'signin' ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
            <button type="button" className="admin-auth-option" disabled={busy !== null} onClick={() => { setUseEmail(false); setError('') }}>Dùng thiết bị</button>
          </form>
        ) : (
          <div className="admin-auth-device">
            {displayError && <p className="admin-auth-error" role="alert">{displayError}</p>}
            <button className="admin-auth-submit" type="button" disabled={busy !== null} onClick={() => { void activateDevice() }}>
              <Laptop size={18} />{busy === 'device' ? 'Đang tạo mã...' : 'Dùng thiết bị này'}
            </button>
            <button className="admin-auth-option" type="button" disabled={busy !== null} onClick={showEmailSignIn}>Dùng tài khoản quản trị</button>
          </div>
        )}
      </section>}
    </AdminDashboardLayout>
  </div>
}
