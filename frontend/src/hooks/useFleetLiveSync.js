import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFleetLiveTracking } from '../api/tracking'
import {
  CONNECTION_STATES,
  getEcho,
  isRealtimeConfigured,
  onConnectionStateChange,
} from '../services/realtime/echo'
import {
  deliveriesChanged,
  FLEET_SYNC_INTERVAL_MS,
  secondsSince,
} from '../utils/fleetLiveSync'

const FLEET_CHANNEL = 'fleet.live'
const LOCATION_EVENT = '.driver.location.updated'

/**
 * Real-time fleet sync for the dispatcher tracking map.
 *
 * WebSocket-first (Laravel Reverb/Pusher): one HTTP snapshot bootstraps routes and
 * static markers, then every driver GPS ping arrives as a pushed
 * DriverLocationUpdated event. A short HTTP poll still runs as a safety net when
 * the socket is quiet or BROADCAST_CONNECTION is not wired in production.
 *
 * Falls back to poll-only when no Reverb/Pusher key is configured at build time.
 */
export default function useFleetLiveSync() {
  const [deliveries, setDeliveries] = useState([])
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [syncError, setSyncError] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [connectionState, setConnectionState] = useState(
    isRealtimeConfigured() ? CONNECTION_STATES.CONNECTING : CONNECTION_STATES.DISCONNECTED,
  )
  const [tick, setTick] = useState(Date.now())

  const inFlightRef = useRef(false)
  const knownIdsRef = useRef(new Set())

  const sync = useCallback(async () => {
    if (inFlightRef.current) return

    inFlightRef.current = true
    try {
      const res = await fetchFleetLiveTracking()
      const next = Array.isArray(res?.data) ? res.data : []

      knownIdsRef.current = new Set(next.map((d) => d.id))
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

  // Merge a pushed GPS event into the matching delivery without refetching.
  const applyLocationEvent = useCallback((event) => {
    const tripId = event?.trip_id ?? event?.assignment_id
    if (tripId == null) return

    if (!knownIdsRef.current.has(tripId)) {
      // A trip we have never seen — a new dispatch happened. Pull one snapshot.
      sync()
      return
    }

    const location = event.location && typeof event.location === 'object'
      ? event.location
      : {
          lat: Number(event.latitude),
          lng: Number(event.longitude),
          at: event.timestamp ?? new Date().toISOString(),
          heading: event.heading ?? null,
          speed_kmh: event.speed_kmh ?? event.speed ?? null,
          accuracy_m: event.accuracy_m ?? null,
          battery_level: event.battery_level ?? null,
          is_stale: false,
          is_critical_stale: false,
          offline: { state: 'online', label: null, age_seconds: 0 },
        }

    setDeliveries((prev) =>
      prev.map((delivery) =>
        delivery.id === tripId ? { ...delivery, location } : delivery,
      ),
    )
    setLastSyncedAt(new Date())
    setSyncError('')
  }, [sync])

  useEffect(() => {
    sync()

    const onVisibility = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Safety-net poll even with WebSockets — covers silent socket / log driver.
    const interval = window.setInterval(() => {
      if (!document.hidden) sync()
    }, FLEET_SYNC_INTERVAL_MS)

    if (!isRealtimeConfigured()) {
      return () => {
        window.clearInterval(interval)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }

    const echo = getEcho()
    const channel = echo.private(FLEET_CHANNEL)
    channel.listen(LOCATION_EVENT, applyLocationEvent)

    let wasDisconnected = false
    const unbindConnection = onConnectionStateChange((state) => {
      setConnectionState(state)
      if (state === CONNECTION_STATES.CONNECTED && wasDisconnected) {
        sync()
        wasDisconnected = false
      }
      if (
        state === CONNECTION_STATES.UNAVAILABLE ||
        state === CONNECTION_STATES.DISCONNECTED
      ) {
        wasDisconnected = true
      }
    })

    return () => {
      window.clearInterval(interval)
      channel.stopListening(LOCATION_EVENT)
      echo.leave(FLEET_CHANNEL)
      unbindConnection()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [sync, applyLocationEvent])

  // 1s UI clock for "x seconds ago" labels (display only — not data polling).
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
    realtime: isRealtimeConfigured(),
    connectionState,
    isSocketConnected: connectionState === CONNECTION_STATES.CONNECTED,
  }
}
