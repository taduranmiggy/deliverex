import { API_URL } from '../../config/api.js'
import SessionManager, { SESSION_EXPIRED_EVENT } from './SessionManager'

export { SESSION_EXPIRED_EVENT }

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
  const token = SessionManager.getAccessToken()
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
      credentials: 'include', // FR 1.17 — send HttpOnly refresh cookie on web
    })
  } catch {
    throw new Error(
      'Cannot reach the API server. Confirm the backend is running (e.g. php artisan serve) and that CORS allows this site.',
    )
  }

  // Proactive refresh when token is about to expire (not on auth endpoints).
  if (
    !_retry &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/refresh') &&
    SessionManager.isAccessTokenExpiringSoon()
  ) {
    try {
      await SessionManager.refreshAccessToken()
      return apiRequest(path, options, true)
    } catch {
      // fall through — server will 401 if refresh failed
    }
  }

  if (response.status === 401 && !_retry && !path.startsWith('/auth/')) {
    try {
      await SessionManager.refreshAccessToken()
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
