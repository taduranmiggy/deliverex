/**
 * Official delivery event time vs synchronization metadata.
 */

export function getEventAt(row) {
  if (!row) return null
  return row.event_at
    ?? row.status_event_at
    ?? row.reported_event_at
    ?? row.submitted_event_at
    ?? row.uploaded_event_at
    ?? row.completed_event_at
    ?? row.started_event_at
    ?? row.assigned_event_at
    ?? row.created_at
    ?? row.status_at
    ?? null
}

export function getSyncedAt(row) {
  if (!row) return null
  return row.synced_at
    ?? row.status_synced_at
    ?? null
}

export function wasPerformedOffline(row) {
  if (!row) return false
  if (row.performed_offline === true || row.status_performed_offline === true) return true
  return Boolean(getSyncedAt(row))
}

export function formatEventAt(row, locale, options) {
  const value = getEventAt(row)
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(locale, options)
}

export function formatSyncedAt(row, locale, options) {
  const value = getSyncedAt(row)
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(locale, options)
}

export function formatOfflineSyncLabel(row, locale, options) {
  if (!wasPerformedOffline(row)) return null
  const syncedLabel = formatSyncedAt(row, locale, options)
  return syncedLabel ? `Performed offline · Synced ${syncedLabel}` : 'Performed offline'
}
