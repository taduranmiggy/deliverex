import useSyncOnReconnect from '../../hooks/useSyncOnReconnect'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

function DriverOfflineBar() {
  const { syncState, pendingCount, isOnline, manualSync } = useSyncOnReconnect()

  const syncIcon = syncState === 'syncing'
    ? <RefreshCw size={14} className="driver-spin" />
    : isOnline ? <Wifi size={14} /> : <WifiOff size={14} />

  const label = !isOnline
    ? 'Offline'
    : syncState === 'syncing'
      ? 'Syncing…'
      : pendingCount > 0
        ? 'Pending Synchronization'
        : syncState === 'synced'
          ? 'Synced'
          : 'Online'

  return (
    <div className={`driver-conn-bar ${isOnline ? 'driver-conn-bar--online' : 'driver-conn-bar--offline'}`}>
      <span className={`driver-conn-dot ${isOnline ? 'online' : 'offline'}`} />
      {syncIcon}
      <span>{label}</span>
      {pendingCount > 0 && (
        <span className="driver-conn-queued">{pendingCount} queued</span>
      )}
      <div style={{ flex: 1 }} />
      {pendingCount > 0 && isOnline && (
        <button
          type="button"
          className="driver-conn-sync-btn"
          onClick={manualSync}
          disabled={syncState === 'syncing'}
        >
          Sync now
        </button>
      )}
    </div>
  )
}

export default DriverOfflineBar
