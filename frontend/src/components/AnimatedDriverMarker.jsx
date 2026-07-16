import { useEffect, useRef } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'

const ANIMATION_MS = 900

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

/**
 * Leaflet marker that smoothly animates between GPS coordinate updates.
 */
export default function AnimatedDriverMarker({
  id,
  position,
  icon,
  zIndexOffset = 500,
  markerRef,
  eventHandlers,
  children,
}) {
  const markerInstanceRef = useRef(null)
  const frameRef = useRef(null)
  const fromRef = useRef(position)

  useEffect(() => {
    const marker = markerInstanceRef.current
    if (!marker) {
      fromRef.current = position
      return undefined
    }

    const from = fromRef.current
    const to = position
    const same =
      Math.abs(from[0] - to[0]) < 0.000001 &&
      Math.abs(from[1] - to[1]) < 0.000001

    if (same) {
      return undefined
    }

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
    }

    const start = performance.now()

    const step = (now) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS)
      const eased = easeInOut(t)
      const lat = lerp(from[0], to[0], eased)
      const lng = lerp(from[1], to[1], eased)
      marker.setLatLng(L.latLng(lat, lng))

      if (t < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [position[0], position[1]])

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={zIndexOffset}
      ref={(ref) => {
        markerInstanceRef.current = ref
        if (markerRef) markerRef.current[id] = ref
      }}
      eventHandlers={eventHandlers}
    >
      {children}
    </Marker>
  )
}
