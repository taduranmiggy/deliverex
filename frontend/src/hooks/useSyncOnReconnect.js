import { useCallback, useEffect, useRef, useState } from 'react'
import { getConflictLog, getQueue } from '../utils/offlineQueue'
import { offlineSyncWithRefresh } from '../services/session/OfflineSyncManager'
import SessionManager from '../services/session/SessionManager'
import useOnlineStatus from './useOnlineStatus'

const SYNCED_DISMISS_MS = 4000 // auto-hide "Synced" banner after 4 s

/**
 * Manages offline queue synchronisation.
 *
 * Returned values:
 *   syncState     — 'idle' | 'syncing' | 'synced' | 'failed'
 *   lastSynced    — Date | null  (timestamp of most recent successful sync)
 *   pendingCount  — number of items still in the queue
 *   conflictCount — number of logged conflicts
 *   isOnline      — current connectivity
 *   manualSync    — () => void  (trigger sync programmatically)
 */
function useSyncOnReconnect() {
  const isOnline      = useOnlineStatus()
  const wasOnlineRef  = useRef(isOnline)
  const dismissTimer  = useRef(null)

  const [syncState,     setSyncState]     = useState('idle')
  const [lastSynced,    setLastSynced]    = useState(null)
  const [pendingCount,  setPendingCount]  = useState(() => getQueue().length)
  const [conflictCount, setConflictCount] = useState(() => getConflictLog().length)

  const refreshCounts = useCallback(() => {
    setPendingCount(getQueue().length)
    setConflictCount(getConflictLog().length)
  }, [])

  const scheduleAutoDismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => {
      setSyncState((s) => (s === 'synced' ? 'idle' : s))
    }, SYNCED_DISMISS_MS)
  }, [])

  const runSync = useCallback(async () => {
    const queue = getQueue()
    if (queue.length === 0) {
      setPendingCount(0)
      return
    }

    setSyncState('syncing')
    try {
      // FR 1.21 — silent refresh before syncing queued driver actions.
      if (SessionManager.getAccessToken() && SessionManager.isAccessTokenExpiringSoon(60_000)) {
        await SessionManager.refreshAccessToken()
      }
      const result = await offlineSyncWithRefresh()
      setLastSynced(new Date())
      setPendingCount(result.remaining ?? 0)
      setConflictCount(getConflictLog().length)

      if (result.remaining === 0) {
        setSyncState('synced')
        scheduleAutoDismiss()
      } else {
        setSyncState('failed')
      }
    } catch {
      setSyncState('failed')
      refreshCounts()
    }
  }, [refreshCounts, scheduleAutoDismiss])

  // Auto-sync on reconnect
  useEffect(() => {
    const wasOnline = wasOnlineRef.current
    wasOnlineRef.current = isOnline

    if (isOnline && !wasOnline) {
      runSync()
    }

    if (!isOnline) {
      setSyncState('idle')
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [isOnline, runSync])

  // Listen for Background Sync trigger from service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handleMessage = (event) => {
      if (event.data?.type === 'BG_SYNC' && navigator.onLine) runSync()
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [runSync])

  // Keep counts current on every render (queue changes from same tab)
  useEffect(() => { refreshCounts() })

  // Cleanup timer on unmount
  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }, [])

  return {
    syncState,
    lastSynced,
    pendingCount,
    conflictCount,
    isOnline,
    manualSync: runSync,
  }
}

export default useSyncOnReconnect
