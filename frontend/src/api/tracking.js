import { apiRequest } from './client'

export function fetchTrackingLogs(assignmentId, page = 1, includeHistory = false) {
  const params = new URLSearchParams({ page: String(page) })
  if (includeHistory) params.set('include_history', '1')
  return apiRequest(`/tracking/${assignmentId}?${params.toString()}`)
}

export function fetchJobOrderTracking(jobOrderId, includeHistory = false) {
  const params = includeHistory ? '?include_history=1' : ''
  return apiRequest(`/job-orders/${jobOrderId}/tracking${params}`)
}
