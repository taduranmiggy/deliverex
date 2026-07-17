/** Date preset ids — must match backend ExportDateRange::presetRange keys. */
export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
  { id: 'all', label: 'All Records' },
]

export const DEFAULT_EXPORT_PRESET = 'last_30_days'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toDateString(d) {
  return d.toISOString().slice(0, 10)
}

/** Client-side preset → [from, to] for date inputs (YYYY-MM-DD). */
export function presetToDates(preset) {
  const today = startOfDay(new Date())

  switch (preset) {
    case 'today':
      return [toDateString(today), toDateString(today)]
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return [toDateString(y), toDateString(y)]
    }
    case 'last_7_days': {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return [toDateString(from), toDateString(today)]
    }
    case 'last_30_days': {
      const from = new Date(today)
      from.setDate(from.getDate() - 29)
      return [toDateString(from), toDateString(today)]
    }
    case 'this_month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      return [toDateString(from), toDateString(today)]
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const to = new Date(today.getFullYear(), today.getMonth(), 0)
      return [toDateString(from), toDateString(to)]
    }
    case 'all':
      return [null, null]
    default:
      return [null, null]
  }
}

export function formatDateRangeLabel(from, to, allRecords = false) {
  if (allRecords) return 'All records'
  if (from && to) return from === to ? from : `${from} – ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return 'Custom range'
}
