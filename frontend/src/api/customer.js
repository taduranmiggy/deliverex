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

export function sendCustomerConcern(payload) {
  return apiRequest('/customer/portal/concerns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMyConcerns(page = 1, perPage = 6) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  return apiRequest(`/customer/portal/concerns?${params}`)
}

export function fetchCustomerOrders() {
  return apiRequest('/customer/portal/orders')
}

export function linkCustomerDelivery(trackingCode) {
  return apiRequest('/customer/portal/link-delivery', {
    method: 'POST',
    body: JSON.stringify({ tracking_code: trackingCode }),
  })
}
