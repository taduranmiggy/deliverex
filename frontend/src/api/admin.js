import { apiRequest } from './client'

export function fetchUsers(page = 1) {
  return apiRequest(`/admin/users?page=${page}`)
}

export function fetchDrivers(page = 1) {
  return apiRequest(`/admin/drivers?page=${page}`)
}

export function fetchVehicles(page = 1) {
  return apiRequest(`/admin/vehicles?page=${page}`)
}

export function fetchOcrQueue(page = 1) {
  return apiRequest(`/admin/ocr/review?page=${page}`)
}
