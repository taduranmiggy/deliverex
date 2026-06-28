import { AlertTriangle, CheckCircle2, Cloud, Loader2, RefreshCw, WifiOff } from 'lucide-react'

/**
 * Canonical offline-sync vocabulary shared by the Driver App and Customer PWA.
 *
 * This is a PRESENTATION-ONLY helper. It does not perform or alter any sync;
 * it just maps existing connectivity/queue state into one consistent set of
 * labels so every surface says the same thing: Queued, Syncing, Synced, Failed.
 */

export const SYNC_STATES = {
  offline: { label: 'Offline', Icon: WifiOff, cls: 'dx-sync-chip--offline' },
  queued:  { label: 'Queued',  Icon: RefreshCw, cls: 'dx-sync-chip--queued' },
  syncing: { label: 'Syncing', Icon: Loader2, cls: 'dx-sync-chip--syncing', spin: true },
  synced:  { label: 'Synced',  Icon: CheckCircle2, cls: 'dx-sync-chip--synced' },
  failed:  { label: 'Failed',  Icon: AlertTriangle, cls: 'dx-sync-chip--failed' },
  online:  { label: 'Online',  Icon: Cloud, cls: 'dx-sync-chip--online' },
}

/**
 * Derive a canonical state from the values already returned by
 * useSyncOnReconnect()/useOnlineStatus(). Mirrors the existing precedence in
 * DriverOfflineBar so behavior is unchanged — only the vocabulary is unified.
 */
export function deriveSyncState({ isOnline, syncState = 'idle', pendingCount = 0 }) {
  if (!isOnline) return 'offline'
  if (syncState === 'syncing') return 'syncing'
  if (syncState === 'failed' && pendingCount > 0) return 'failed'
  if (pendingCount > 0) return 'queued'
  if (syncState === 'synced') return 'synced'
  return 'online'
}

function SyncStatusChip({ state = 'online', count = 0, showCount = true, className = '' }) {
  const cfg = SYNC_STATES[state] ?? SYNC_STATES.online
  const { label, Icon, cls, spin } = cfg
  const suffix = showCount && count > 0 && (state === 'queued' || state === 'failed') ? ` · ${count}` : ''

  return (
    <span
      className={`dx-sync-chip ${cls} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <Icon size={13} className={spin ? 'driver-spin' : undefined} aria-hidden="true" />
      <span>{label}{suffix}</span>
    </span>
  )
}

export default SyncStatusChip
