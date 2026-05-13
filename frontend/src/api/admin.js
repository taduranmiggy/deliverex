import { apiRequest } from './client'

// ─── Fetch (list) ─────────────────────────────────────────────────────────────
export function fetchUsers(page = 1)       { return apiRequest(`/admin/users?page=${page}`) }
export function fetchDrivers(page = 1)     { return apiRequest(`/admin/drivers?page=${page}`) }
export function fetchVehicles(page = 1)    { return apiRequest(`/admin/vehicles?page=${page}`) }
export function fetchOcrQueue(page = 1, filter = 'all') {
  return apiRequest(`/admin/ocr/review?page=${page}&filter=${filter}`)
}
export function fetchRoles()               { return apiRequest('/admin/roles') }
export function fetchAuditLogs(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString()
  return apiRequest(`/admin/audit-logs${qs ? '?' + qs : ''}`)
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function createUser(payload)        { return apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateUser(id, payload)    { return apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteUser(id)             { return apiRequest(`/admin/users/${id}`, { method: 'DELETE' }) }

// ─── Drivers ──────────────────────────────────────────────────────────────────
export function createDriver(payload)      { return apiRequest('/admin/drivers', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateDriver(id, payload)  { return apiRequest(`/admin/drivers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteDriver(id)           { return apiRequest(`/admin/drivers/${id}`, { method: 'DELETE' }) }

// ─── Vehicles ─────────────────────────────────────────────────────────────────
export function createVehicle(payload)     { return apiRequest('/admin/vehicles', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateVehicle(id, payload) { return apiRequest(`/admin/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteVehicle(id)          { return apiRequest(`/admin/vehicles/${id}`, { method: 'DELETE' }) }

// ─── OCR ──────────────────────────────────────────────────────────────────────
export function validateOcr(id, payload)   {
  return apiRequest(`/admin/ocr/${id}/validate`, { method: 'PUT', body: JSON.stringify(payload) })
}

// ─── Inquiries ────────────────────────────────────────────────────────────────
export function fetchInquiries(page = 1, status = 'all') {
  return apiRequest(`/inquiries?page=${page}&status=${status}`)
}
export function markInquiryRead(id)        { return apiRequest(`/inquiries/${id}/read`, { method: 'PUT' }) }
export function convertInquiry(id)         { return apiRequest(`/inquiries/${id}/convert`, { method: 'POST' }) }
export function deleteInquiry(id)          { return apiRequest(`/inquiries/${id}`, { method: 'DELETE' }) }
