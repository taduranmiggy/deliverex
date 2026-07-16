/** Marker colors by canonical delivery status. */
export const GPS_STATUS_COLORS = {
  assigned: '#6b7280',
  en_route_to_pickup: '#2563eb',
  arrived_at_pickup: '#eab308',
  en_route_to_destination: '#f97316',
  arrived_at_destination: '#22c55e',
  completed: '#166534',
  cancelled: '#94a3b8',
  en_route: '#2563eb',
  in_progress: '#f97316',
  arrived: '#22c55e',
}

export function gpsColorForStatus(status) {
  const key = String(status || 'assigned').toLowerCase().replace(/ /g, '_')
  return GPS_STATUS_COLORS[key] ?? GPS_STATUS_COLORS.assigned
}

export function gpsOfflineLabel(offline) {
  if (!offline) return null
  if (offline.state === 'temporarily_offline') return 'Driver temporarily offline.'
  if (offline.state === 'gps_lost') return 'GPS signal lost.'
  return offline.label ?? null
}
