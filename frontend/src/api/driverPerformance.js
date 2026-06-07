import { apiRequest } from './client'

export function fetchDriverPerformance(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/driver-performance${qs ? '?' + qs : ''}`)
}
