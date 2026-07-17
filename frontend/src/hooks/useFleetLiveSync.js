import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFleetLiveTracking } from '../api/tracking'
import {
  deliveriesChanged,
  FLEET_SYNC_INTERVAL_MS,
  secondsSince,
} from '../utils/fleetLiveSync'

/**
 * Polls the fleet-live API every 60s for dispatcher map sync.
 * Prevents overlapping requests and preserves the last good payload on errors.
 */
export default function useFleetLiveSync() {
  const [deliveries, setDeliveries] = useState([])
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [syncError, setSyncError] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [tick, setTick] = useState(Date.now())

  const inFlightRef = useRef(false)
  const intervalRef = useRef(null)

  const sync = useCallback(async () => {
    if (inFlightRef.current || document.hidden) return

    inFlightRef.current = true
    try {
      const res = await fetchFleetLiveTracking()
      const next = Array.isArray(res?.data) ? res.data : []

      setDeliveries((prev) => (deliveriesChanged(prev, next) ? next : prev))
      setLastSyncedAt(res?.synced_at ? new Date(res.synced_at) : new Date())
      setSyncError('')
    } catch (err) {
      setSyncError(err.message || 'Synchronization failed.')
    } finally {
      inFlightRef.current = false
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    sync()

    intervalRef.current = window.setInterval(sync, FLEET_SYNC_INTERVAL_MS)

    const onVisibility = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [sync])

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const secondsSinceSync = secondsSince(lastSyncedAt)

  return {
    deliveries,
    lastSyncedAt,
    secondsSinceSync,
    syncError,
    initialLoading,
    tick,
    resync: sync,
  }
}
