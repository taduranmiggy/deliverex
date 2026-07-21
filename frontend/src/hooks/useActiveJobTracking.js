import { useEffect, useRef } from 'react'
import { postTrackingUpdate } from '../api/driver'
import { enqueue } from '../utils/offlineQueue'

const GPS_ACTIVE = new Set([
  'assigned',
  'en_route_to_pickup',
  'arrived_at_pickup',
  'en_route_to_destination',
  'arrived_at_destination',
  'en_route',
  'in_progress',
  'arrived',
])

const MOVING_INTERVAL_MS = Number(import.meta.env.VITE_GPS_INTERVAL_MOVING_SECONDS || 15) * 1000
const STOPPED_INTERVAL_MS = Number(import.meta.env.VITE_GPS_INTERVAL_STOPPED_SECONDS || 15) * 1000
const MOVING_SPEED_KMH = Number(import.meta.env.VITE_GPS_MOVING_SPEED_THRESHOLD_KMH || 3)

function buildPayload(assignment, pos) {
  const speedMs = pos.coords.speed
  const speedKmh = Number.isFinite(speedMs) && speedMs >= 0 ? speedMs * 3.6 : null

  return {
    assignment_id: assignment.id,
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy_m: pos.coords.accuracy,
    heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
    speed_kmh: speedKmh,
    captured_at: new Date(pos.timestamp || Date.now()).toISOString(),
    source: 'auto_interval',
  }
}

function isActiveGpsStatus(status) {
  const normalized = String(status || '').toLowerCase().replace(/ /g, '_')
  return GPS_ACTIVE.has(normalized)
}

/**
 * Automatically sends GPS while the driver has an active in-transit assignment.
 */
export default function useActiveJobTracking(activeAssignment, isOnline) {
  const watchIdRef = useRef(null)
  const timerRef = useRef(null)
  const lastSpeedRef = useRef(0)

  useEffect(() => {
    if (!activeAssignment || !isActiveGpsStatus(activeAssignment.status)) {
      if (watchIdRef.current != null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return undefined
    }

    if (!navigator.geolocation) {
      return undefined
    }

    const sendPosition = (pos) => {
      const payload = buildPayload(activeAssignment, pos)
      lastSpeedRef.current = payload.speed_kmh ?? 0

      if (!isOnline) {
        enqueue({ type: 'tracking', payload, action_timestamp: payload.captured_at })
        return
      }

      postTrackingUpdate(payload).catch(() => {
        enqueue({ type: 'tracking', payload, action_timestamp: payload.captured_at })
      })
    }

    const tick = () => {
      navigator.geolocation.getCurrentPosition(sendPosition, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      })
    }

    const getIntervalMs = () =>
      (lastSpeedRef.current ?? 0) >= MOVING_SPEED_KMH ? MOVING_INTERVAL_MS : STOPPED_INTERVAL_MS

    const scheduleNext = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        tick()
        scheduleNext()
      }, getIntervalMs())
    }

    tick()
    scheduleNext()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const payload = buildPayload(activeAssignment, pos)
        lastSpeedRef.current = payload.speed_kmh ?? 0
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [activeAssignment?.id, activeAssignment?.status, isOnline])
}
