import { useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AnimatedDriverMarker from './AnimatedDriverMarker'
import { gpsColorForStatus, gpsOfflineLabel } from '../utils/gpsStatusColors'

const DEFAULT_CENTER = [14.5995, 120.9842]
const PICKUP_COLOR = '#059669'
const DEST_COLOR = '#dc2626'

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`

function makeDriverIcon(color) {
  const size = 34
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-map-truck" style="width:${size}px;height:${size}px;color:${color}">${TRUCK_SVG}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  })
}

function makePinIcon(color) {
  const size = 30
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-map-destination" style="width:${size}px;height:${size}px;color:${color}">${PIN_SVG}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  })
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function CustomerLiveMap({
  driverLocation,
  pickup,
  destination,
  route,
  status,
  offline,
  lastUpdated,
  eta,
  height = 280,
}) {
  const [ready, setReady] = useState(false)

  const markers = useMemo(() => {
    const items = []
    if (pickup?.lat != null && pickup?.lng != null) items.push({ lat: pickup.lat, lng: pickup.lng })
    if (destination?.lat != null && destination?.lng != null) items.push({ lat: destination.lat, lng: destination.lng })
    if (driverLocation?.lat != null && driverLocation?.lng != null) items.push({ lat: driverLocation.lat, lng: driverLocation.lng })
    return items
  }, [driverLocation, pickup, destination])

  const center = useMemo(() => {
    if (markers.length === 0) return DEFAULT_CENTER
    const lat = markers.reduce((s, m) => s + m.lat, 0) / markers.length
    const lng = markers.reduce((s, m) => s + m.lng, 0) / markers.length
    return [lat, lng]
  }, [markers])

  const routePositions = useMemo(() => {
    if (Array.isArray(route?.polyline) && route.polyline.length > 1) {
      return route.polyline.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]))
    }
    if (driverLocation && destination?.lat != null) {
      return [[driverLocation.lat, driverLocation.lng], [destination.lat, destination.lng]]
    }
    return []
  }, [route, driverLocation, destination])

  const offlineLabel = gpsOfflineLabel(offline ?? driverLocation?.offline)

  if (markers.length === 0) {
    return (
      <div className="dx-customer-live-map dx-customer-live-map--empty" style={{ minHeight: height }}>
        Live map will appear when the driver shares a location.
      </div>
    )
  }

  const driverColor = gpsColorForStatus(status)

  return (
    <div className="dx-customer-live-map" style={{ minHeight: height }}>
      {offlineLabel && (
        <p className="dx-customer-live-map__offline" role="status">{offlineLabel}</p>
      )}
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height, width: '100%', borderRadius: 12 }}
        whenReady={() => setReady(true)}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {routePositions.length > 1 && (
          <Polyline positions={routePositions} pathOptions={{ color: driverColor, weight: 4, opacity: 0.85 }} />
        )}
        {pickup?.lat != null && <Marker position={[pickup.lat, pickup.lng]} icon={makePinIcon(PICKUP_COLOR)} />}
        {destination?.lat != null && <Marker position={[destination.lat, destination.lng]} icon={makePinIcon(DEST_COLOR)} />}
        {driverLocation?.lat != null && ready && (
          <AnimatedDriverMarker
            id="customer-driver"
            position={[driverLocation.lat, driverLocation.lng]}
            icon={makeDriverIcon(driverColor)}
            zIndexOffset={800}
          />
        )}
      </MapContainer>
      <div className="dx-customer-live-map__meta">
        <span>Last updated: {formatTime(lastUpdated ?? driverLocation?.at)}</span>
        {eta?.estimated_arrival_label && <span>ETA: {eta.estimated_arrival_label}</span>}
        {eta?.remaining_distance_label && <span>{eta.remaining_distance_label} remaining</span>}
      </div>
    </div>
  )
}
