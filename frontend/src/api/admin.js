import { apiRequest } from './client'

import { API_URL } from '../config/api.js'

/** Fetch document image with auth — use with URL.createObjectURL for <img src>. */
export async function fetchDocumentPreviewBlob(documentId) {
  const token = localStorage.getItem('deliverex_token')
  const response = await fetch(`${API_URL}/documents/${documentId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Could not load document preview. Run php artisan storage:link on the server.')
  }
  return response.blob()
}

// ─── Companies (B2B) ─────────────────────────────────────────────────────────
export function fetchCompanies(query = '') {
  return apiRequest(`/admin/companies${query ? `?${query}` : ''}`)
}
export function createCompany(payload) {
  return apiRequest('/admin/companies', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateCompany(id, payload) {
  return apiRequest(`/admin/companies/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function resendCompanyActivation(id) {
  return apiRequest(`/admin/companies/${id}/resend-activation`, { method: 'POST' })
}

// ─── Fetch (list) ─────────────────────────────────────────────────────────────
export function fetchUsers(page = 1, perPage = 6) { return apiRequest(`/admin/users?page=${page}&per_page=${perPage}`) }
export function fetchDrivers(page = 1)     { return apiRequest(`/admin/drivers?page=${page}`) }
export function fetchVehicles(page = 1)    { return apiRequest(`/admin/vehicles?page=${page}`) }
export function fetchOcrQueue(page = 1, filter = 'all', params = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    filter,
    ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  }).toString()
  return apiRequest(`/ocr/review?${qs}`)
}

export async function exportOcrReport(format = 'pdf', params = {}) {
  const token = localStorage.getItem('deliverex_token')
  const qs = new URLSearchParams(
    {
      format,
      ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    },
  ).toString()
  const response = await fetch(`${API_URL}/admin/ocr/review/export${qs ? `?${qs}` : ''}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to export OCR report.')
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] || `ocr-review_${new Date().toISOString().slice(0, 10)}.${format}`

  return { blob, filename }
}
export function fetchRoles()               { return apiRequest('/admin/roles') }
export function fetchAuditLogs(params = {}) {
  return import('./export').then(({ buildExportQuery }) => {
    const qs = buildExportQuery(params)
    return apiRequest(`/admin/audit-logs${qs ? `?${qs}` : ''}`)
  })
}

export async function exportAuditLogs(format, filters = {}) {
  const { buildExportQuery } = await import('./export')
  const qs = buildExportQuery({ format, ...filters })

  const token = localStorage.getItem('deliverex_token')
  const response = await fetch(`${API_URL}/admin/audit-logs/export?${qs}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to export audit logs.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] || `audit-logs_${new Date().toISOString().slice(0, 10)}.${format}`

  return { blob, filename }
}

export async function exportEnterpriseReport(type, format = 'pdf', filters = {}) {
  const qs = new URLSearchParams({
    type,
    format,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== '')),
  }).toString()
  const token = localStorage.getItem('deliverex_token')
  const response = await fetch(`${API_URL}/reports/export?${qs}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to export report.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] || `${type}_${new Date().toISOString().slice(0, 10)}.${format}`

  return { blob, filename }
}

export function fetchEmailLogs(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString()
  return apiRequest(`/admin/email-logs${qs ? '?' + qs : ''}`)
}
export function fetchEmailLogStats() {
  return apiRequest('/admin/email-logs/stats')
}
export function fetchEmailLogTypes() {
  return apiRequest('/admin/email-logs/types')
}
export function retryEmailLog(id) {
  return apiRequest(`/admin/email-logs/${id}/retry`, { method: 'POST' })
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function createUser(payload)        { return apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateUser(id, payload)    { return apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function sendUserInvite(id)         { return apiRequest(`/admin/users/${id}/send-invite`, { method: 'POST' }) }
export function deleteUser(id)             { return apiRequest(`/admin/users/${id}`, { method: 'DELETE' }) }

// ─── Drivers ──────────────────────────────────────────────────────────────────
export function createDriver(payload)      { return apiRequest('/admin/drivers', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateDriver(id, payload)  { return apiRequest(`/admin/drivers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteDriver(id)           { return apiRequest(`/admin/drivers/${id}`, { method: 'DELETE' }) }

// ─── Vehicles ─────────────────────────────────────────────────────────────────
export function createVehicle(payload)     { return apiRequest('/admin/vehicles', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateVehicle(id, payload) { return apiRequest(`/admin/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteVehicle(id)          { return apiRequest(`/admin/vehicles/${id}`, { method: 'DELETE' }) }

// ─── Master Data ──────────────────────────────────────────────────────────────
export function fetchMasterData() {
  return apiRequest('/admin/master-data')
}
export function createMasterDataRecord(resource, payload) {
  return apiRequest(`/admin/master-data/${resource}`, { method: 'POST', body: JSON.stringify(payload) })
}
export function updateMasterDataRecord(resource, id, payload) {
  return apiRequest(`/admin/master-data/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function archiveMasterDataRecord(resource, id) {
  return apiRequest(`/admin/master-data/${resource}/${id}`, { method: 'DELETE' })
}
export function generateDriverAccount(driverId) {
  return apiRequest(`/admin/master-data/drivers/${driverId}/generate-account`, { method: 'POST' })
}
export function generateAllDriverAccounts() {
  return apiRequest('/admin/master-data/drivers/generate-all-accounts', { method: 'POST' })
}

// ─── OCR ──────────────────────────────────────────────────────────────────────
export function validateOcr(id, payload)   {
  return apiRequest(`/ocr/${id}/validate`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function saveOcrCorrections(id, payload) {
  return apiRequest(`/ocr/${id}/corrections`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function reprocessOcr(documentId)  {
  return apiRequest(`/ocr/process/${documentId}`, { method: 'POST' })
}

// ─── Inquiries ────────────────────────────────────────────────────────────────
export function fetchInquiries(page = 1, status = 'all') {
  return apiRequest(`/inquiries?page=${page}&status=${status}&per_page=6`)
}
export function markInquiryRead(id)        { return apiRequest(`/inquiries/${id}/read`, { method: 'PUT' }) }
export function convertInquiry(id)         { return apiRequest(`/inquiries/${id}/convert`, { method: 'POST' }) }
export function deleteInquiry(id)          { return apiRequest(`/inquiries/${id}`, { method: 'DELETE' }) }

// ─── Chatbot intents ──────────────────────────────────────────────────────────
export function fetchChatbotIntents(search = '') {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiRequest(`/admin/chatbot/intents${qs}`)
}
export function fetchChatbotIntent(id) {
  return apiRequest(`/admin/chatbot/intents/${id}`)
}
export function fetchChatbotStats() {
  return apiRequest('/admin/chatbot/stats')
}
export function createChatbotIntent(payload) {
  return apiRequest('/admin/chatbot/intents', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateChatbotIntent(id, payload) {
  return apiRequest(`/admin/chatbot/intents/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function deleteChatbotIntent(id) {
  return apiRequest(`/admin/chatbot/intents/${id}`, { method: 'DELETE' })
}
