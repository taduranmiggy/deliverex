import { apiRequest } from './client'

export function fetchDriverProfile(historyPage = 1) {
  return apiRequest(`/driver/profile?history_page=${historyPage}`)
}

export function fetchDriverAssignments(page = 1) {
  return apiRequest(`/driver/assignments?page=${page}`)
}

export function fetchDriverAssignment(id) {
  return apiRequest(`/driver/assignments/${id}`)
}

export function postStatusUpdate(payload) {
  return apiRequest('/driver/status', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postTrackingUpdate(payload) {
  return apiRequest('/driver/tracking', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function uploadDocument(formData) {
  return apiRequest('/driver/documents', {
    method: 'POST',
    body: formData,
  })
}
