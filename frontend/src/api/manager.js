import { apiRequest } from './client'
import * as tokenStorage from '../services/session/tokenStorage'

export function fetchManagerDashboard() {
  return apiRequest('/manager/dashboard')
}

export function fetchAnalytics(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/manager/analytics${qs ? '?' + qs : ''}`)
}

export function fetchReports(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/manager/reports${qs ? '?' + qs : ''}`)
}

/** @deprecated use fetchReports with params object */
export function fetchReportsLegacy(page = 1, status = '') {
  return fetchReports({ page, per_page: 6, status: status || undefined })
}

export async function exportManagerReport(type, format, filters = {}) {
  const qs = new URLSearchParams({
    type,
    format,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== '')),
  }).toString()

  const token = tokenStorage.getAccessToken()
  const base = import.meta.env.VITE_API_URL || '/api'
  const response = await fetch(`${base}/manager/reports/export?${qs}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  })

  if (!response.ok) {
    let message = 'Export failed'
    try {
      const data = await response.json()
      message = data.message || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] || `${type}_${new Date().toISOString().slice(0, 10)}.${format}`

  return { blob, filename }
}
