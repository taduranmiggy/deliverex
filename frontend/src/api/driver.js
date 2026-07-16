import { apiRequest } from './client'

import { API_URL } from '../config/api.js'

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

/** Mobile PWA alias — same ingest pipeline as /driver/tracking */
export function postMobileLocationUpdate(payload) {
  return apiRequest('/mobile/location/update', {
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

export function uploadIssueReport(formData) {
  return apiRequest('/driver/issues', {
    method: 'POST',
    body: formData,
  })
}

export function postDelayReport(payload) {
  return apiRequest('/driver/delays', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchSyncConflicts(page = 1) {
  return apiRequest(`/driver/sync-conflicts?page=${page}`)
}

export function resolveSyncConflict(payload) {
  return apiRequest('/driver/sync-conflicts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function uploadCompletionProof(formData) {
  return apiRequest('/driver/completion-proof', {
    method: 'POST',
    body: formData,
  })
}
