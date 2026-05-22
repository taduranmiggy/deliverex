import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const DEFAULT_CENTER = [14.5995, 120.9842]

/**
 * @param {{ markers: Array<{ id: number|string, lat: number, lng: number, label: string, sublabel?: string }> }} props
 */
function LiveFleetMap({ markers = [] }) {
  const valid = useMemo(
    () => markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
    [markers],
  )

  const center = useMemo(() => {
    if (valid.length > 0) {
      const lat = valid.reduce((s, m) => s + m.lat, 0) / valid.length
      const lng = valid.reduce((s, m) => s + m.lng, 0) / valid.length
      return [lat, lng]
    }
    return DEFAULT_CENTER
  }, [valid])

  useEffect(() => {
    // Leaflet needs explicit height on parent
  }, [])

  if (valid.length === 0) {
    return (
      <div style={{ minHeight: 360, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '0.875rem', background: 'var(--slate-50)', borderRadius: 12 }}>
        No GPS coordinates yet. Drivers will appear here after location updates.
      </div>
    )
  }

  return (
    <MapContainer
      center={center}
      zoom={valid.length === 1 ? 13 : 11}
      style={{ height: 400, width: '100%', borderRadius: 12, zIndex: 0 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {valid.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]}>
          <Popup>
            <strong>{m.label}</strong>
            {m.sublabel && <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>{m.sublabel}</div>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export default LiveFleetMap
