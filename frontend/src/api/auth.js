import { apiRequest, loadRefreshBody, postRefreshRequest } from './client'
import { buildSessionMeta } from '../services/session/DeviceSessionManager'

export async function login(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...buildSessionMeta() }),
  })
}

export async function refreshSession(payload = {}) {
  const body = await loadRefreshBody(payload)
  return postRefreshRequest(body)
}

export async function activateCompany(token, payload) {
  return apiRequest(`/auth/company/activate/${token}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchCompanyActivation(token) {
  return apiRequest(`/auth/company/activate/${token}`)
}

export async function getProfile() {
  return apiRequest('/auth/me')
}

export async function updateProfile(payload) {
  return apiRequest('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getSessionInfo() {
  return apiRequest('/auth/session')
}

export async function resendVerification(payload) {
  return apiRequest('/auth/verify/resend', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return apiRequest('/auth/logout', { method: 'POST' })
}

export async function revokeSession(payload = {}) {
  return apiRequest('/auth/revoke', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function changePassword(payload) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function forgotPassword(payload) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchPasswordResetContext({ email, token }) {
  const params = new URLSearchParams({ email, token })
  return apiRequest(`/auth/reset-password/context?${params.toString()}`)
}

export async function fetchAccountActivationContext({ email, token }) {
  const params = new URLSearchParams({ email, token })
  return apiRequest(`/auth/activate-account/context?${params.toString()}`)
}

export async function resetPassword(payload) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
