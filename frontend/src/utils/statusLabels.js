export function formatJobStatus(status) {
  const s = String(status || '').toLowerCase().replace(/ /g, '_')
  if (s === 'pending') return 'Pending'
  if (s === 'assigned' || s === 'dispatched') return 'Dispatched'
  if (s === 'in_progress' || s === 'en_route') return 'En Route'
  if (s === 'arrived') return 'Arrived'
  if (s === 'completed' || s === 'completed_with_pod') return 'Completed'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'delayed') return 'Delayed'
  return status ? String(status).replace(/_/g, ' ') : '—'
}

export function jobStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase().replace(/ /g, '_')
  if (s === 'in_progress' || s === 'en_route') return 'badge-dx badge-dx--enroute'
  if (s === 'pending')     return 'badge-dx badge-dx--pending'
  if (s === 'assigned' || s === 'dispatched')    return 'badge-dx badge-dx--dispatched'
  if (s === 'arrived')     return 'badge-dx badge-dx--arrived'
  if (s === 'completed' || s === 'completed_with_pod')   return 'badge-dx badge-dx--completed'
  if (s === 'cancelled')   return 'badge-dx badge-dx--cancelled'
  if (s === 'delayed')     return 'badge-dx badge-dx--pending'
  return 'badge-dx badge-dx--muted'
}

export const STATUS_OPTIONS = [
  { value: 'assigned',    label: 'Dispatched' },
  { value: 'in_progress', label: 'En Route' },
  { value: 'arrived',     label: 'Arrived' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]
