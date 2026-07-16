import { useMemo, useState } from 'react'
import { MapContainer, Polyline, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function formatPointTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  })
}

export default function TripHistoryReplay({ history = [], height = 260, title = 'Trip history' }) {
  const [index, setIndex] = useState(0)

  const points = useMemo(
    () => (Array.isArray(history) ? history.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)) : []),
    [history],
  )

  const positions = useMemo(() => points.map((p) => [p.lat, p.lng]), [points])
  const current = points[index] ?? null
  const center = current ? [current.lat, current.lng] : (positions[0] ?? [14.5995, 120.9842])

  if (points.length === 0) return null

  return (
    <div className="dx-trip-history">
      <div className="dx-trip-history__header">
        <h4>{title}</h4>
        <span>{index + 1} / {points.length}</span>
      </div>
      <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height, borderRadius: 10 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {positions.length > 1 && (
          <Polyline positions={positions.slice(0, index + 1)} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.8 }} />
        )}
      </MapContainer>
      <input
        type="range"
        min={0}
        max={Math.max(0, points.length - 1)}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        className="dx-trip-history__slider"
        aria-label="Trip replay position"
      />
      {current && (
        <dl className="dx-trip-history__details">
          <div><dt>Time</dt><dd>{formatPointTime(current.at)}</dd></div>
          <div><dt>Coordinates</dt><dd>{current.lat.toFixed(5)}, {current.lng.toFixed(5)}</dd></div>
          {Number.isFinite(current.speed_kmh) && (
            <div><dt>Speed</dt><dd>{current.speed_kmh.toFixed(1)} km/h</dd></div>
          )}
          {current.status && (
            <div><dt>Status</dt><dd>{String(current.status).replace(/_/g, ' ')}</dd></div>
          )}
        </dl>
      )}
    </div>
  )
}
