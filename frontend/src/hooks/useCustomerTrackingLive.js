import { useEffect, useRef } from 'react'
import { getEcho, isRealtimeConfigured } from '../services/realtime/echo'

const LOCATION_EVENT = '.driver.location.updated'

/**
 * Subscribe to the public tracking.{CODE} channel for instant GPS updates.
 * Falls back silently when Pusher/Reverb keys are not baked into the build.
 *
 * @param {string|null} trackingCode
 * @param {(location: object) => void} onLocation
 */
export default function useCustomerTrackingLive(trackingCode, onLocation) {
  const onLocationRef = useRef(onLocation)
  onLocationRef.current = onLocation

  useEffect(() => {
    const code = typeof trackingCode === 'string' ? trackingCode.trim().toUpperCase() : ''
    if (!code || !isRealtimeConfigured()) return undefined

    const echo = getEcho()
    if (!echo) return undefined

    const channelName = `tracking.${code}`
    const channel = echo.channel(channelName)

    channel.listen(LOCATION_EVENT, (event) => {
      const lat = Number(event?.latitude ?? event?.location?.lat)
      const lng = Number(event?.longitude ?? event?.location?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

      onLocationRef.current({
        lat: Math.round(lat * 1e5) / 1e5,
        lng: Math.round(lng * 1e5) / 1e5,
        at: event?.timestamp ?? event?.location?.at ?? new Date().toISOString(),
        is_stale: false,
        offline: { state: 'online', label: null, age_seconds: 0 },
        ...(event?.location && typeof event.location === 'object' ? {
          heading: event.location.heading ?? null,
          speed_kmh: event.location.speed_kmh ?? null,
        } : {}),
      })
    })

    return () => {
      channel.stopListening(LOCATION_EVENT)
      echo.leave(channelName)
    }
  }, [trackingCode])
}
