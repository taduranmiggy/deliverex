import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff, X } from 'lucide-react'
import useSyncOnReconnect from '../../hooks/useSyncOnReconnect'

function fmtTime(date) {
  if (!date) return null
  return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
}

/**
 * Driver connectivity + sync status bar.
 *
 * Bar states:
 *   offline  — amber/red: "⚠ Offline Mode — N updates pending"
 *   pending  — amber: "N updates waiting to sync" + [Sync Queue] button
 *   syncing  — blue: "🔄 Syncing N updates…"
 *   synced   — green (auto-dismisses after 4 s): "✓ Synced · 10:30 AM"
 *   failed   — red: "✕ Sync Failed — N still pending" + [Retry] button
 *   online   — hidden (no bar; system is healthy and idle)
 */
function DriverOfflineBar() {
  const { syncState, lastSynced, pendingCount, conflictCount, isOnline, manualSync } =
    useSyncOnReconnect()

  const barState = useMemo(() => {
    if (!isOnline)                                return 'offline'
    if (syncState === 'syncing')                  return 'syncing'
    if (syncState === 'failed' && pendingCount > 0) return 'failed'
    if (pendingCount > 0)                         return 'pending'
    if (syncState === 'synced')                   return 'synced'
    return 'online'
  }, [isOnline, syncState, pendingCount])

  // Nothing to show — system is healthy
  if (barState === 'online') return null

  /* ── Per-state content ─────────────────────────────────────── */
  let cls   = 'driver-sync-bar'
  let Icon  = WifiOff
  let text  = 'Offline Mode'
  let btnLabel  = null
  let spinning  = false

  if (barState === 'offline') {
    cls  += ' driver-sync-bar--offline'
    Icon  = WifiOff
    text  = pendingCount > 0
      ? `Offline — ${pendingCount} update${pendingCount !== 1 ? 's' : ''} pending`
      : 'Offline Mode'
  } else if (barState === 'pending') {
    cls     += ' driver-sync-bar--pending'
    Icon     = AlertTriangle
    text     = `${pendingCount} update${pendingCount !== 1 ? 's' : ''} waiting to sync`
    btnLabel = 'Sync Queue'
  } else if (barState === 'syncing') {
    cls     += ' driver-sync-bar--syncing'
    Icon     = Loader2
    text     = `Syncing ${pendingCount} update${pendingCount !== 1 ? 's' : ''}…`
    spinning = true
  } else if (barState === 'synced') {
    cls  += ' driver-sync-bar--synced'
    Icon  = CheckCircle2
    text  = `Synced successfully${lastSynced ? ` · ${fmtTime(lastSynced)}` : ''}`
  } else if (barState === 'failed') {
    cls     += ' driver-sync-bar--failed'
    Icon     = X
    text     = `Sync failed — ${pendingCount} update${pendingCount !== 1 ? 's' : ''} still pending`
    btnLabel = 'Retry'
  }

  return (
    <div className={cls} role="status" aria-live="polite" aria-atomic="true">
      {/* State icon */}
      <span className="driver-sync-bar__icon" aria-hidden="true">
        <Icon size={15} className={spinning ? 'driver-spin' : undefined} />
      </span>

      {/* Status text */}
      <span className="driver-sync-bar__text">{text}</span>

      {/* Conflict badge — shown when server has rejected actions */}
      {conflictCount > 0 && (
        <span
          className="driver-sync-bar__conflicts"
          title={`${conflictCount} action${conflictCount !== 1 ? 's were' : ' was'} rejected by the server and logged for review`}
        >
          {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Action button (Sync Queue / Retry) */}
      {btnLabel && (
        <button
          type="button"
          className="driver-sync-bar__btn"
          onClick={manualSync}
          disabled={syncState === 'syncing'}
          aria-label={btnLabel}
        >
          {syncState === 'syncing'
            ? <Loader2 size={12} className="driver-spin" />
            : <RefreshCw size={12} />}
          {btnLabel}
        </button>
      )}
    </div>
  )
}

export default DriverOfflineBar
