import { useCallback, useEffect, useRef, useState } from 'react'
import { getQueue } from '../utils/offlineQueue'
import { syncQueue } from '../utils/syncQueue'
import useOnlineStatus from './useOnlineStatus'

/**
 * Automatically flushes the offline queue whenever the device comes back online.
 * Returns { syncState, lastSynced, pendingCount, manualSync }.
 * syncState: 'idle' | 'syncing' | 'synced' | 'failed'
 */
function useSyncOnReconnect() {
  const isOnline = useOnlineStatus()
  const wasOnlineRef = useRef(isOnline)
  const [syncState, setSyncState] = useState('idle')
  const [lastSynced, setLastSynced] = useState(null)
  const [pendingCount, setPendingCount] = useState(() => getQueue().length)

  const runSync = useCallback(async () => {
    const queue = getQueue()
    if (queue.length === 0) {
      setPendingCount(0)
      return
    }

    setSyncState('syncing')
    try {
      const result = await syncQueue()
      setPendingCount(result.remaining)
      setSyncState(result.remaining === 0 ? 'synced' : 'failed')
      setLastSynced(new Date())
    } catch {
      setSyncState('failed')
      setPendingCount(getQueue().length)
    }
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    const wasOnline = wasOnlineRef.current
    wasOnlineRef.current = isOnline

    if (isOnline && !wasOnline) {
      runSync()
    }

    if (!isOnline) {
      setSyncState('idle')
    }
  }, [isOnline, runSync])

  // Keep pendingCount in sync with queue
  useEffect(() => {
    setPendingCount(getQueue().length)
  })

  return {
    syncState,
    lastSynced,
    pendingCount,
    isOnline,
    manualSync: runSync,
  }
}

export default useSyncOnReconnect
