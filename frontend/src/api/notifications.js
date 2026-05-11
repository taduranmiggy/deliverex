import { apiRequest } from './client'

export function fetchNotifications(page = 1) {
  return apiRequest(`/notifications?page=${page}`)
}

export function markNotificationRead(id) {
  return apiRequest(`/notifications/${id}/read`, {
    method: 'PUT',
  })
}
