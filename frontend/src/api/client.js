import { API_URL } from '../config/api.js'

function formatApiError(payload, status) {
  if (payload?.message) {
    return String(payload.message)
  }
  if (payload?.errors && typeof payload.errors === 'object') {
    const firstKey = Object.keys(payload.errors)[0]
    const first = firstKey ? payload.errors[firstKey] : null
    if (Array.isArray(first) && first[0]) {
      return String(first[0])
    }
  }
  if (status === 401) {
    return 'Invalid credentials'
  }
  return 'Request failed'
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('deliverex_token')
  const isForm = options.body instanceof FormData
  const headers = {
    // Always tell Laravel this is an API client so that unauthenticated requests
    // receive HTTP 401 JSON instead of a redirect to route('login') (which does
    // not exist in this API-only app and would crash with HTTP 500 otherwise).
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
    })
  } catch {
    throw new Error(
      'Cannot reach the API server. Confirm the backend is running (e.g. php artisan serve) and that CORS allows this site.',
    )
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(formatApiError(error, response.status))
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}
