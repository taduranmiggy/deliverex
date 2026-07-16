/**
 * JobOrderRouteMap — pickup + destination markers with routed polyline.
 */
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../components/LiveFleetMap.css'
import { fetchJobOrderMap } from '../api/jobOrders'
import { Loader2, MapPin, Navigation } from 'lucide-react'

const DEFAULT_CENTER = [14.5995, 120.9842]
const PICKUP_COLOR = '#16a34a'
const DEST_COLOR = '#dc2626'
const ROUTE_COLOR = '#2563eb'

function FitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
    }
  }, [map, points])

  return null
}

function makePinIcon(color, label) {
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-job-route-pin" style="background:${color}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

export default function JobOrderRouteMap({ jobOrderId, readOnly = true }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobOrderId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')

    fetchJobOrderMap(jobOrderId)
      .then((res) => {
        if (!cancelled) setData(res?.data ?? res)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load map.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [jobOrderId])

  const points = useMemo(() => {
    const items = []
    if (data?.pickup?.lat != null && data?.pickup?.lng != null) items.push(data.pickup)
    if (data?.destination?.lat != null && data?.destination?.lng != null) items.push(data.destination)
    return items
  }, [data])

  const polyline = useMemo(
    () => (data?.route?.polyline ?? []).filter((p) => Array.isArray(p) && p.length >= 2),
    [data],
  )

  if (loading) {
    return (
      <div className="dx-job-route-map dx-job-route-map--loading" aria-busy="true">
        <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
        <span>Loading route map…</span>
      </div>
    )
  }

  if (error) {
    return <div className="dx-job-route-map dx-job-route-map--error">{error}</div>
  }

  if (points.length === 0) {
    return (
      <div className="dx-job-route-map dx-job-route-map--empty">
        Map unavailable — addresses could not be geocoded yet.
      </div>
    )
  }

  const center = [
    points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  ]

  return (
    <div className="dx-job-route-map">
      <div className="dx-job-route-map__meta">
        <div className="dx-job-route-map__stat">
          <Navigation size={15} aria-hidden />
          <span>{data?.route?.distance_label ?? '—'}</span>
        </div>
        <div className="dx-job-route-map__stat">
          <MapPin size={15} aria-hidden />
          <span>{data?.route?.duration_label ?? '—'}</span>
        </div>
        {readOnly && <span className="dx-job-route-map__badge">View only</span>}
      </div>

      <div className="dx-job-route-map__stage">
        <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />

          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: ROUTE_COLOR, weight: 4.5, opacity: 0.88 }}
            />
          )}

          {data?.pickup?.lat != null && (
            <Marker position={[data.pickup.lat, data.pickup.lng]} icon={makePinIcon(PICKUP_COLOR, 'P')}>
              <Popup>
                <strong>Pickup</strong>
                <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>{data.pickup.address || '—'}</div>
              </Popup>
            </Marker>
          )}

          {data?.destination?.lat != null && (
            <Marker position={[data.destination.lat, data.destination.lng]} icon={makePinIcon(DEST_COLOR, 'D')}>
              <Popup>
                <strong>Destination</strong>
                <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>{data.destination.address || '—'}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
