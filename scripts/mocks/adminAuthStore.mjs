const copy = (value) => structuredClone(value)
const listeners = new Set()
let session = {
  loading: false,
  configured: true,
  user: { uid: 'e2e-authorized-admin', email: 'admin@example.invalid' },
  isAuthorized: true,
  error: '',
  ...(globalThis.__E2E_AUTH_INITIAL__ ?? {}),
}
let signInOptions = { outcome: 'authorized' }
let heldSignIn = null
const loginCalls = []
let signOutCalls = 0

function emit(updates) {
  session = { ...session, ...copy(updates) }
  for (const listener of listeners) listener(copy(session))
}

export function subscribeAdminSession(onState) {
  listeners.add(onState)
  queueMicrotask(() => {
    if (listeners.has(onState)) onState(copy(session))
  })
  return () => listeners.delete(onState)
}

export async function signInAdmin(email, password) {
  loginCalls.push({ email: email.trim(), hasPassword: Boolean(password) })
  if (heldSignIn) await heldSignIn.promise
  if (!session.configured) throw new Error('Chưa thiết lập UID quản trị. Cấu hình VITE_FIREBASE_ADMIN_UIDS.')
  if (!email.trim() || !password) throw new Error('Vui lòng nhập email và mật khẩu.')
  if (signInOptions.outcome === 'error') throw new Error(signInOptions.message || 'Email hoặc mật khẩu không đúng.')
  if (signInOptions.outcome === 'denied') {
    emit({ user: null, isAuthorized: false, loading: false, error: '' })
    throw new Error('Tài khoản này không có quyền quản trị danh mục. Vui lòng dùng tài khoản được cấp quyền.')
  }
  emit({ loading: false, user: { uid: 'e2e-authorized-admin', email: email.trim() }, isAuthorized: true, error: '' })
}

export async function signOutAdmin() {
  signOutCalls += 1
  emit({ loading: false, user: null, isAuthorized: false, error: '' })
}

globalThis.__E2E_AUTH__ = {
  snapshot: () => ({ ...copy(session), loginCalls: copy(loginCalls), signOutCalls }),
  setSession: emit,
  configureSignIn(options) { signInOptions = { outcome: 'authorized', ...copy(options) } },
  holdSignIn() {
    let release
    const promise = new Promise((resolve) => { release = resolve })
    heldSignIn = { promise, release }
  },
  releaseSignIn() { heldSignIn?.release(); heldSignIn = null },
}
