import { apiRequest } from './client'

export function fetchVehicleUtilization(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return apiRequest(`/manager/vehicle-utilization${qs ? '?' + qs : ''}`)
}
