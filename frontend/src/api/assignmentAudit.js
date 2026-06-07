import { apiRequest } from './client'

export function fetchAssignmentAuditTrails(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/assignment-audit${qs ? '?' + qs : ''}`)
}
