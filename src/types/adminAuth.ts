export interface AdminUser {
  uid: string
  email: string | null
  isAnonymous: boolean
}

export interface AdminSession {
  loading: boolean
  configured: boolean
  user: AdminUser | null
  isAuthorized: boolean
  error: string
}
