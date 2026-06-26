import { clearEncryptedRefresh, saveEncryptedRefresh } from './secureStorage'

const ACCESS_KEY = 'deliverex_token'
const USER_KEY = 'deliverex_user'
const SESSION_ID_KEY = 'deliverex_session_id'
const EXPIRES_AT_KEY = 'deliverex_token_expires_at'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getSessionId() {
  return localStorage.getItem(SESSION_ID_KEY)
}

export function getExpiresAt() {
  const raw = localStorage.getItem(EXPIRES_AT_KEY)
  return raw ? Number(raw) : null
}

export async function persist(payload) {
  const access = payload.access_token ?? payload.token
  if (access) {
    localStorage.setItem(ACCESS_KEY, access)
  }
  if (payload.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
  }
  if (payload.session_id) {
    localStorage.setItem(SESSION_ID_KEY, payload.session_id)
  }
  if (payload.expires_in) {
    const expiresAt = Date.now() + payload.expires_in * 1000
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt))
  }
  if (payload.refresh_token) {
    await saveEncryptedRefresh(payload.refresh_token)
  }
}

export function clear() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(SESSION_ID_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
  clearEncryptedRefresh()
}

export function isAccessTokenExpiringSoon(bufferMs = 120_000) {
  const exp = getExpiresAt()
  if (!exp) return false
  return exp - Date.now() <= bufferMs
}
