import { apiRequest } from './client'

export function searchPreciseLocations(payload) {
  return apiRequest('/geocoding/autocomplete', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function geocodeManualAddress(payload) {
  return apiRequest('/geocoding/geocode', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmPreciseLocation(traceId, payload) {
  return apiRequest(`/geocoding/traces/${encodeURIComponent(traceId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function reportRenderedLocation(traceId, latitude, longitude) {
  if (!traceId) return Promise.resolve(null)
  return apiRequest(`/geocoding/traces/${encodeURIComponent(traceId)}/rendered`, {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  })
}
