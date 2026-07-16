import { apiRequest } from './client'

export function fetchJobOrderMap(jobOrderId) {
  return apiRequest(`/job-orders/${jobOrderId}/map`)
}
