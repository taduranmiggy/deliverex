export function vehicleFleetBadge(vehicle) {
  const s = String(vehicle?.status ?? '').toLowerCase()
  if (s === 'assigned' || s === 'in_use' || s === 'in_operation') {
    return { label: 'In Use', className: 'badge-dx badge-dx--vehicle-inuse' }
  }
  if (s === 'maintenance') {
    return { label: 'Maintenance', className: 'badge-dx badge-dx--vehicle-maint' }
  }
  return { label: 'Available', className: 'badge-dx badge-dx--vehicle-available' }
}

export function formatLastMaintenanceIso(isoLike) {
  if (!isoLike) return '—'
  try {
    const d = new Date(isoLike)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toISOString().slice(0, 10)
  } catch {
    return '—'
  }
}

export function demoLicenseExpiry(seed) {
  const n = Number(seed) || 1
  const y = 2026 + (n % 3)
  const m = String(((n * 5) % 11) + 1).padStart(2, '0')
  return `${y}-${m}-15`
}

export function demoPhoneIntl(seed) {
  const n = Number(seed) || 1
  const tail = String(9170000000 + ((n * 1347) % 999999)).slice(0, 9)
  return `+63 ${tail.slice(0, 3)} ${tail.slice(3, 6)} ${tail.slice(6)}`
}
