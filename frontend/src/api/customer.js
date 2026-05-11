import { apiRequest } from './client'

export function trackDelivery(code) {
  return apiRequest(`/customer/track/${encodeURIComponent(code.trim())}`)
}

export function sendInquiry(payload) {
  return apiRequest('/customer/inquiry', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchCustomerOrders() {
  return apiRequest('/customer/portal/orders')
}
