import { buildSessionMeta, detectPlatform } from './DeviceSessionManager'
import { loadEncryptedRefresh } from './secureStorage'
import * as tokenStorage from './tokenStorage'
import { API_URL } from '../../config/api.js'

export const SESSION_EXPIRED_EVENT = 'deliverex:session-expired'

let refreshPromise = null
let refreshTimer = null

function scheduleSilentRefresh(expiresInSeconds) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const leadMs = Math.max(60_000, (expiresInSeconds - 300) * 1000)
  refreshTimer = setTimeout(() => {
    refreshAccessToken().catch(() => {})
  }, leadMs)
}

function formatRefreshError(payload, status) {
  if (payload?.message) return String(payload.message)
  if (status === 401) return 'Session expired. Please login again.'
  return 'Refresh failed'
}

/**
 * FR 1.13 / FR 1.21 — silent refresh via direct fetch (no api/client import).
 */
export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const platform = detectPlatform()
    const body = { platform, ...buildSessionMeta() }
    const encRefresh = await loadEncryptedRefresh()
    if (encRefresh) body.refresh_token = encRefresh

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(formatRefreshError(data, response.status))
    }

    await tokenStorage.persist(data)
    if (data.expires_in) scheduleSilentRefresh(data.expires_in)
    return data
  })()

  try {
    return await refreshPromise
  } catch (err) {
    tokenStorage.clear()
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: err }))
    throw err
  } finally {
    refreshPromise = null
  }
}

/** FR 1.12–1.17 — session facade used by AuthContext and login pages. */
export const SessionManager = {
  getAccessToken: tokenStorage.getAccessToken,
  getSessionId: tokenStorage.getSessionId,
  getExpiresAt: tokenStorage.getExpiresAt,
  persist: async (payload) => {
    await tokenStorage.persist(payload)
    if (payload.expires_in) scheduleSilentRefresh(payload.expires_in)
  },
  clear: tokenStorage.clear,
  isAccessTokenExpiringSoon: tokenStorage.isAccessTokenExpiringSoon,
  refreshAccessToken,
  scheduleSilentRefresh,
}

export default SessionManager
