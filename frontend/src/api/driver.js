import { apiRequest } from './client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export function fetchDriverProfile(historyPage = 1) {
  return apiRequest(`/driver/profile?history_page=${historyPage}`)
}

export function updateDriverProfile(payload) {
  return apiRequest('/driver/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
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

export function uploadDocumentWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('deliverex_token')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/driver/documents`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(new Error(data.message || 'Document upload failed'))
      } catch {
        reject(new Error('Document upload failed'))
      }
    }
    xhr.onerror = () => reject(new Error('Document upload failed'))
    xhr.send(formData)
  })
}

export function postIssueReport(payload) {
  return apiRequest('/driver/issues', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
