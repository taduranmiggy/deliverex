import { apiRequest } from './client'
import { buildSessionMeta } from '../services/session/DeviceSessionManager'

export async function login(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ...buildSessionMeta() }),
  })
}

export async function refreshSession(payload = {}) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ ...buildSessionMeta(), ...payload }),
  })
}

export async function registerCustomer(payload) {
  return apiRequest('/auth/register/customer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getProfile() {
  return apiRequest('/auth/me')
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
