import { API_URL } from '../config/api.js'
import { buildSessionMeta, detectPlatform } from '../services/session/DeviceSessionManager'
import { loadEncryptedRefresh } from '../services/session/secureStorage'
import * as tokenStorage from '../services/session/tokenStorage'

export { SESSION_EXPIRED_EVENT } from '../services/session/SessionManager'

function formatApiError(payload, status) {
  if (payload?.message) return String(payload.message)
  if (payload?.errors && typeof payload.errors === 'object') {
    const firstKey = Object.keys(payload.errors)[0]
    const first = firstKey ? payload.errors[firstKey] : null
    if (Array.isArray(first) && first[0]) return String(first[0])
  }
  if (status === 401) return 'Session expired. Please login again.'
  return 'Request failed'
}

/**
 * FR 1.13 — wraps fetch: on 401, attempt one silent refresh then retry.
 */
export async function apiRequest(path, options = {}, _retry = false) {
  const token = tokenStorage.getAccessToken()
  const isForm = options.body instanceof FormData
  const headers = {
    Accept: 'application/json',
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new Error(
      'Cannot reach the API server. Confirm the backend is running (e.g. php artisan serve) and that CORS allows this site.',
    )
  }

  if (
    !_retry &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/refresh') &&
    tokenStorage.isAccessTokenExpiringSoon()
  ) {
    try {
      const { refreshAccessToken } = await import('../services/session/SessionManager')
      await refreshAccessToken()
      return apiRequest(path, options, true)
    } catch {
      // fall through
    }
  }

  if (response.status === 401 && !_retry && !path.startsWith('/auth/')) {
    try {
      const { refreshAccessToken } = await import('../services/session/SessionManager')
      await refreshAccessToken()
      return apiRequest(path, options, true)
    } catch {
      const error = await response.json().catch(() => ({}))
      throw new Error(formatApiError(error, response.status))
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(formatApiError(error, response.status))
  }

  if (response.status === 204) return null

  return response.json()
}

/** Used by auth.refreshSession — direct POST without interceptor recursion. */
export async function postRefreshRequest(body) {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(formatApiError(data, response.status))
  }
  return data
}

export function buildRefreshBody(extra = {}) {
  const platform = detectPlatform()
  return { platform, ...buildSessionMeta(), ...extra }
}

export async function loadRefreshBody(extra = {}) {
  const body = buildRefreshBody(extra)
  const encRefresh = await loadEncryptedRefresh()
  if (encRefresh) body.refresh_token = encRefresh
  return body
}
