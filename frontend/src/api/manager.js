import { apiRequest } from './client'

export function fetchManagerDashboard() {
  return apiRequest('/manager/dashboard')
}

export function fetchAnalytics(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/manager/analytics${qs ? '?' + qs : ''}`)
}

export function fetchReports(page = 1, status = '') {
  const qs = new URLSearchParams({ page })
  if (status) qs.set('status', status)
  return apiRequest(`/manager/reports?${qs.toString()}`)
}
