import { refreshSession as refreshApi } from '../../api/auth'
import { buildSessionMeta, detectPlatform } from './DeviceSessionManager'
import { clearEncryptedRefresh, loadEncryptedRefresh, saveEncryptedRefresh } from './secureStorage'

const ACCESS_KEY = 'deliverex_token'
const USER_KEY = 'deliverex_user'
const SESSION_ID_KEY = 'deliverex_session_id'
const EXPIRES_AT_KEY = 'deliverex_token_expires_at'

/** Custom event dispatched when refresh fails (FR 1.18). */
export const SESSION_EXPIRED_EVENT = 'deliverex:session-expired'

let refreshPromise = null
let refreshTimer = null

/**
 * FR 1.12–1.17 — central session persistence (access JWT + refresh token).
 */
export const SessionManager = {
  getAccessToken() {
    return localStorage.getItem(ACCESS_KEY)
  },

  getSessionId() {
    return localStorage.getItem(SESSION_ID_KEY)
  },

  getExpiresAt() {
    const raw = localStorage.getItem(EXPIRES_AT_KEY)
    return raw ? Number(raw) : null
  },

  /**
   * Persist tokens after login or refresh.
   * @param {{ token?: string, access_token?: string, refresh_token?: string, expires_in?: number, session_id?: string, user?: object }} payload
   */
  async persist(payload) {
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
      this.scheduleSilentRefresh(payload.expires_in)
    }
    if (payload.refresh_token) {
      await saveEncryptedRefresh(payload.refresh_token)
    }
  },

  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(SESSION_ID_KEY)
    localStorage.removeItem(EXPIRES_AT_KEY)
    clearEncryptedRefresh()
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  },

  /** FR 1.13 — refresh access token ~5 minutes before expiry. */
  scheduleSilentRefresh(expiresInSeconds) {
    if (refreshTimer) clearTimeout(refreshTimer)
    const leadMs = Math.max(60_000, (expiresInSeconds - 300) * 1000)
    refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch(() => {})
    }, leadMs)
  },

  /**
   * FR 1.13 / FR 1.21 — silent refresh (cookie on web, encrypted body on PWA).
   */
  async refreshAccessToken() {
    if (refreshPromise) return refreshPromise

    refreshPromise = (async () => {
      const platform = detectPlatform()
      const body = { platform, ...buildSessionMeta() }

      const encRefresh = await loadEncryptedRefresh()
      if (encRefresh) body.refresh_token = encRefresh

      const res = await refreshApi(body)
      await this.persist(res)
      return res
    })()

    try {
      return await refreshPromise
    } catch (err) {
      this.clear()
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: err }))
      throw err
    } finally {
      refreshPromise = null
    }
  },

  isAccessTokenExpiringSoon(bufferMs = 120_000) {
    const exp = this.getExpiresAt()
    if (!exp) return false
    return exp - Date.now() <= bufferMs
  },
}

export default SessionManager
