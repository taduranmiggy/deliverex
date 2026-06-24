import { apiRequest } from './client'

export async function login(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Create a consumer account (role: customer) and returns { token, user }. */
export async function registerCustomer(payload) {
  return apiRequest('/auth/register/customer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getProfile() {
  return apiRequest('/auth/me')
}

export async function resendVerification(payload) {
  return apiRequest('/auth/verify/resend', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return apiRequest('/auth/logout', {
    method: 'POST',
  })
}

export async function changePassword(payload) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
