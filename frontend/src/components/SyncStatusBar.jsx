import { Loader2, RefreshCw } from 'lucide-react'
import SyncStatusChip, { deriveSyncState } from './SyncStatusChip'
import useSyncOnReconnect from '../hooks/useSyncOnReconnect'
import useOnlineStatus from '../hooks/useOnlineStatus'

function fmtTime(date) {
  if (!date) return null
  return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
}

const BAR_CLASS = {
  offline: 'driver-sync-bar driver-sync-bar--offline',
  queued: 'driver-sync-bar driver-sync-bar--pending',
  syncing: 'driver-sync-bar driver-sync-bar--syncing',
  synced: 'driver-sync-bar driver-sync-bar--synced',
  failed: 'driver-sync-bar driver-sync-bar--failed',
}

/**
 * Shared synchronization status bar for Driver App and Customer PWA.
 *
 * Presentation only — reuses useSyncOnReconnect / useOnlineStatus without
 * modifying queue or sync behaviour.
 *
 * variant="driver"  — full queue states + Sync/Retry actions (default)
 * variant="customer" — connectivity banner (Offline / Online when not idle)
 */
function SyncStatusBar({ variant = 'driver' }) {
  const isOnline = useOnlineStatus()
  const {
    syncState,
    lastSynced,
    pendingCount,
    conflictCount,
    manualSync,
  } = useSyncOnReconnect()

  const state = deriveSyncState({ isOnline, syncState, pendingCount })

  // Driver: hide when healthy and idle (existing behaviour)
  if (variant === 'driver' && state === 'online') return null

  // Customer: only surface offline / queued / syncing / failed — not transient synced flash
  if (variant === 'customer') {
    if (state === 'online' || state === 'synced') return null
    const message = state === 'offline'
      ? 'You’re offline — showing the latest saved data.'
      : state === 'queued'
        ? `${pendingCount} update${pendingCount !== 1 ? 's' : ''} queued for sync.`
        : state === 'syncing'
          ? 'Syncing your latest changes…'
          : 'Some changes could not sync. They will retry when you reconnect.'

    return (
      <div className="customer-offline-indicator" role="status" aria-live="polite">
        <SyncStatusChip state={state} count={pendingCount} />
        <span>{message}</span>
      </div>
    )
  }

  const btnLabel = state === 'queued' ? 'Sync Queue' : state === 'failed' ? 'Retry' : null
  const detail = state === 'synced' && lastSynced ? ` · ${fmtTime(lastSynced)}` : ''

  return (
    <div className={BAR_CLASS[state] ?? BAR_CLASS.offline} role="status" aria-live="polite" aria-atomic="true">
      <SyncStatusChip state={state} count={pendingCount} className="driver-sync-bar__chip" />
      {state === 'synced' && detail ? (
        <span className="driver-sync-bar__text">{detail.trim()}</span>
      ) : null}

      {conflictCount > 0 && (
        <span
          className="driver-sync-bar__conflicts"
          title={`${conflictCount} action${conflictCount !== 1 ? 's were' : ' was'} rejected by the server and logged for review`}
        >
          {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
        </span>
      )}

      <div style={{ flex: 1 }} />

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

export default SyncStatusBar
