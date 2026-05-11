import { apiRequest } from './client'

export function fetchTrackingLogs(assignmentId, page = 1) {
  return apiRequest(`/tracking/${assignmentId}?page=${page}`)
}
