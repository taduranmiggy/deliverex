import { apiRequest } from './client'

export function fetchJobOrders(page = 1, perPage = 500)   { return apiRequest(`/dispatch/job-orders?page=${page}&per_page=${perPage}`) }
export function fetchJobOrder(id)          { return apiRequest(`/dispatch/job-orders/${id}`) }

export function fetchCalendarEvents(startIso, endIso) {
  const params = new URLSearchParams({ start: startIso, end: endIso })
  return apiRequest(`/dispatch/calendar?${params}`)
}
export function fetchAssignments(page = 1, perPage = 6) { return apiRequest(`/dispatch/assignments?page=${page}&per_page=${perPage}`) }

export function createJobOrder(payload) {
  return apiRequest('/dispatch/job-orders', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateJobOrder(id, payload) {
  return apiRequest(`/dispatch/job-orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteJobOrder(id) {
  return apiRequest(`/dispatch/job-orders/${id}`, { method: 'DELETE' })
}

export function fetchDispatchOptions(jobOrderId) {
  return apiRequest(`/dispatch/assignments/options/${jobOrderId}`)
}

export function createAssignment(payload) {
  return apiRequest('/dispatch/assignments', { method: 'POST', body: JSON.stringify(payload) })
}

export function fetchMasterDataOptions() {
  return apiRequest('/dispatch/master-data/options')
}

export function createMaterialType(name) {
  return apiRequest('/dispatch/master-data/material-types', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function createMaterialSpecification(materialTypeId, name) {
  return apiRequest('/dispatch/master-data/material-specifications', {
    method: 'POST',
    body: JSON.stringify({ material_type_id: materialTypeId, name }),
  })
}

export function fetchDelayReports(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/dispatch/delays${qs ? '?' + qs : ''}`)
}

export function acknowledgeDelayReport(id) {
  return apiRequest(`/dispatch/delays/${id}/acknowledge`, { method: 'PUT' })
}

export function fetchOcrQueue(page = 1, filter = 'all') {
  return apiRequest(`/ocr/review?page=${page}&filter=${filter}`)
}

export function validateOcr(id, payload) {
  return apiRequest(`/ocr/${id}/validate`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function reprocessOcr(documentId) {
  return apiRequest(`/ocr/process/${documentId}`, { method: 'POST' })
}
