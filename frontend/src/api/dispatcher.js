import { apiRequest } from './client'

export function fetchJobOrders(page = 1)   { return apiRequest(`/dispatch/job-orders?page=${page}`) }
export function fetchJobOrder(id)          { return apiRequest(`/dispatch/job-orders/${id}`) }

export function fetchCalendarEvents(startIso, endIso) {
  const params = new URLSearchParams({ start: startIso, end: endIso })
  return apiRequest(`/dispatch/calendar?${params}`)
}
export function fetchAssignments(page = 1) { return apiRequest(`/dispatch/assignments?page=${page}`) }

export function createJobOrder(payload) {
  return apiRequest('/dispatch/job-orders', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateJobOrder(id, payload) {
  return apiRequest(`/dispatch/job-orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteJobOrder(id) {
  return apiRequest(`/dispatch/job-orders/${id}`, { method: 'DELETE' })
}

export function getBestFit(jobOrderId) {
  return apiRequest(`/dispatch/best-fit/${jobOrderId}`)
}

export function createAssignment(payload) {
  return apiRequest('/dispatch/assignments', { method: 'POST', body: JSON.stringify(payload) })
}

export function fetchMasterDataOptions() {
  return apiRequest('/dispatch/master-data/options')
}
