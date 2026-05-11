export function formatJobStatus(status) {
  const s = String(status || '').toLowerCase().replace(/ /g, '_')
  if (s === 'in_progress') return 'En Route'
  if (s === 'assigned') return 'Dispatched'
  if (s === 'pending') return 'Pending'
  if (s === 'completed') return 'Completed'
  if (s === 'cancelled') return 'Cancelled'
  return status ? String(status).replace(/_/g, ' ') : '—'
}

export function jobStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase().replace(/ /g, '_')
  if (s === 'in_progress') return 'badge-dx badge-dx--enroute'
  if (s === 'pending') return 'badge-dx badge-dx--pending'
  if (s === 'assigned') return 'badge-dx badge-dx--dispatched'
  if (s === 'completed') return 'badge-dx badge-dx--completed'
  return 'badge-dx badge-dx--muted'
}
