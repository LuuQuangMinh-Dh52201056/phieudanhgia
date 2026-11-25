import {
  browserSessionPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import type { AdminSession } from '../types/adminAuth'
import { BackendOperationError, getBackendErrorCode } from './firestoreOperations'

const configuredUids = String(import.meta.env.VITE_FIREBASE_ADMIN_UIDS ?? '').split(/[\s,]+/).filter(Boolean)
// Match the rules' placeholder behavior: incomplete setup never authorizes an account.
const authorizedUids = new Set(configuredUids.includes('REPLACE_WITH_ADMIN_UID')
  ? [] : configuredUids.filter((uid) => uid.length <= 128))

function translateAuthError(error: unknown): Error {
  const code = getBackendErrorCode(error)
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/invalid-login-credentials': 'Email hoặc mật khẩu không đúng.',
    'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
    'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
    'auth/missing-password': 'Vui lòng nhập mật khẩu.',
    'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ người quản lý Firebase.',
    'auth/too-many-requests': 'Có quá nhiều lần đăng nhập. Vui lòng chờ ít phút rồi thử lại.',
    'auth/network-request-failed': 'Không thể kết nối dịch vụ đăng nhập. Kiểm tra Internet rồi thử lại.',
    'auth/operation-not-allowed': 'Firebase chưa bật đăng nhập Email/Password. Vui lòng bật phương thức này trong Authentication.',
    'auth/unauthorized-domain': 'Tên miền này chưa được cho phép đăng nhập. Kiểm tra Authorized domains trong Firebase Authentication.',
    'auth/invalid-api-key': 'Cấu hình Firebase không hợp lệ. Vui lòng kiểm tra biến môi trường của ứng dụng.',
    'auth/app-not-authorized': 'Ứng dụng chưa được Firebase cho phép đăng nhập. Vui lòng kiểm tra cấu hình dự án.',
    'auth/internal-error': 'Dịch vụ đăng nhập đang gặp lỗi. Vui lòng thử lại sau.',
  }
  if (messages[code]) return new BackendOperationError(messages[code], code, error)
  if (code.startsWith('auth/')) return new BackendOperationError('Không thể hoàn tất thao tác đăng nhập. Vui lòng thử lại.', code, error)
  return error instanceof Error ? error : new Error('Không thể hoàn tất thao tác đăng nhập. Vui lòng thử lại.')
}

export function subscribeAdminSession(onState: (state: AdminSession) => void): () => void {
  let active = true
  const emit = (state: AdminSession) => {
    if (active) onState(state)
  }
  const configured = authorizedUids.size > 0
  if (!configured) {
    emit({ loading: false, configured: false, user: null, isAuthorized: false, error: '' })
    return () => { active = false }
  }

  emit({ loading: true, configured: true, user: null, isAuthorized: false, error: '' })
  let unsubscribe = () => undefined as void
  try {
    unsubscribe = onAuthStateChanged(
    firebaseAuth,
    (user) => {
      const isAuthorized = user !== null && authorizedUids.has(user.uid)
      emit({
        loading: false,
        configured: true,
        user: user ? { uid: user.uid, email: user.email } : null,
        isAuthorized,
        error: user && !isAuthorized ? 'Tài khoản này không có quyền quản trị danh mục. Vui lòng đăng xuất và dùng tài khoản được cấp quyền.' : '',
      })
    },
    (error) => emit({
      loading: false,
      configured: true,
      user: null,
      isAuthorized: false,
      error: translateAuthError(error).message,
    }),
    )
  } catch (error) {
    queueMicrotask(() => emit({ loading: false, configured: true, user: null, isAuthorized: false, error: translateAuthError(error).message }))
  }

  return () => {
    active = false
    unsubscribe()
  }
}

async function prepareSessionPersistence(): Promise<void> {
  try {
    await setPersistence(firebaseAuth, browserSessionPersistence)
  } catch (error) {
    if (![
      'auth/web-storage-unsupported',
      'auth/operation-not-supported-in-this-environment',
      'auth/unsupported-persistence-type',
    ].includes(getBackendErrorCode(error))) throw error
    await setPersistence(firebaseAuth, inMemoryPersistence)
  }
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  if (authorizedUids.size === 0) {
    throw new BackendOperationError('Chưa thiết lập UID quản trị. Vui lòng cấu hình VITE_FIREBASE_ADMIN_UIDS và triển khai lại ứng dụng.', 'admin/not-configured')
  }
  if (!email.trim() || !password) throw new Error('Vui lòng nhập email và mật khẩu.')
  try {
    await prepareSessionPersistence()
    const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
    if (!authorizedUids.has(credential.user.uid)) {
      await signOut(firebaseAuth)
      throw new BackendOperationError('Tài khoản này không có quyền quản trị. Vui lòng dùng tài khoản được cấp quyền.', 'admin/permission-denied')
    }
  } catch (error) {
    throw translateAuthError(error)
  }
}

export async function signOutAdmin(): Promise<void> {
  try {
    await signOut(firebaseAuth)
  } catch (error) {
    throw translateAuthError(error)
  }
}
