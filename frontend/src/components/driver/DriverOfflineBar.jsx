/**
 * Driver connectivity + sync status bar.
 * Thin wrapper around the shared SyncStatusBar (driver variant).
 */
import SyncStatusBar from '../SyncStatusBar'

function DriverOfflineBar() {
  return <SyncStatusBar variant="driver" />
}

export default DriverOfflineBar
