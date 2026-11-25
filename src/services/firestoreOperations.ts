const WRITE_TIMEOUT_MS = 15_000

export class BackendOperationError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'BackendOperationError'
  }
}

export function getBackendErrorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
}

export function normalizeFirestoreError(error: unknown, action: string): Error {
  if (error instanceof BackendOperationError) return error
  const code = getBackendErrorCode(error)
  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return new BackendOperationError(`Không có quyền ${action}. Hãy đăng nhập tài khoản quản trị được cấp quyền và kiểm tra Firestore Rules đã Publish.`, code, error)
  }
  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return new BackendOperationError(`Không thể ${action} vì mất kết nối. Kiểm tra Internet rồi thử lại.`, code, error)
  }
  if (code.includes('not-found')) {
    return new BackendOperationError(`Dữ liệu cần ${action} không còn tồn tại. Hãy tải lại danh sách.`, code, error)
  }
  return new BackendOperationError(error instanceof Error ? error.message : `Không thể ${action}. Vui lòng thử lại.`, code || 'unknown', error)
}

export function requireDocumentId(value: string, label: string): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id || id === '.' || id === '..' || id.includes('/') || /^__.*__$/.test(id) || new TextEncoder().encode(id).length > 1500) {
    throw new BackendOperationError(`Mã ${label} không hợp lệ.`, 'invalid-argument')
  }
  return id
}

/** Firestore queues writes offline. Bound the UI wait; a timeout cannot cancel a queued write. */
export async function runFirestoreWrite<T>(write: () => Promise<T>, action: string): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new BackendOperationError(`Không thể ${action} vì thiết bị đang ngoại tuyến. Kết nối Internet rồi thử lại.`, 'unavailable')
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      write(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new BackendOperationError(
          `Chưa nhận được xác nhận ${action} từ Firebase. Kiểm tra kết nối và tải lại danh sách trước khi thử lại; yêu cầu đã gửi vẫn có thể hoàn tất khi kết nối trở lại.`,
          'deadline-exceeded',
        )), WRITE_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    throw normalizeFirestoreError(error, action)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
