import { apiRequest } from './client'

export function fetchCompanyUsers() {
  return apiRequest('/company/users')
}

export function createCompanyUser(payload) {
  return apiRequest('/company/users', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCompanyUser(id, payload) {
  return apiRequest(`/company/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteCompanyUser(id) {
  return apiRequest(`/company/users/${id}`, { method: 'DELETE' })
}
