import { apiRequest } from './client'

export function fetchManagerDashboard() {
  return apiRequest('/manager/dashboard')
}

export function fetchAnalytics() {
  return apiRequest('/manager/analytics')
}

export function fetchReports(page = 1) {
  return apiRequest(`/manager/reports?page=${page}`)
}
