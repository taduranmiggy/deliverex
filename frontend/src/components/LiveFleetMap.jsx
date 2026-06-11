/**
 * LiveFleetMap — Leaflet map with two-way card ↔ pin sync.
 *
 * Props:
 *   markers    — array of marker data (see shape below)
 *   selectedId — id of the currently selected marker (controlled by parent)
 *   onSelect   — callback(id) when a pin is clicked
 *
 * Marker shape:
 *   { id, lat, lng, label, sublabel,
 *     jobId, vehicle, status, gpsAt, mapsUrl,
 *     onViewDetails }   ← optional callback for popup "View Details"
 */
import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

const DEFAULT_CENTER = [14.5995, 120.9842]
const NORMAL_SIZE    = 26
const SELECTED_SIZE  = 34

// ── Custom icon factory ────────────────────────────────────────────────────
function makeIcon(isSelected) {
  const size = isSelected ? SELECTED_SIZE : NORMAL_SIZE
  return L.divIcon({
    className: '',
    html: `<div class="dx-map-pin${isSelected ? ' dx-map-pin--selected' : ''}"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 6)],
  })
}

// ── Status label helper ────────────────────────────────────────────────────
function fmtStatus(s) {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── MapController: lives inside MapContainer, handles flyTo ──────────────
function MapController({ markers, selectedId, markerRefs }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedId) return
    const m = markers.find((mk) => mk.id === selectedId)
    if (!m) return

    map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 14), { duration: 0.7, easeLinearity: 0.5 })

    // Open the popup a beat after flyTo starts so Leaflet has positioned it
    const timer = setTimeout(() => {
      const ref = markerRefs.current[selectedId]
      if (ref) ref.openPopup()
    }, 300)

    return () => clearTimeout(timer)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

// ── Main component ─────────────────────────────────────────────────────────
function LiveFleetMap({ markers = [], selectedId = null, onSelect }) {
  const markerRefs = useRef({})

  const valid = useMemo(
    () => markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
    [markers],
  )

  const center = useMemo(() => {
    if (valid.length === 0) return DEFAULT_CENTER
    const lat = valid.reduce((s, m) => s + m.lat, 0) / valid.length
    const lng = valid.reduce((s, m) => s + m.lng, 0) / valid.length
    return [lat, lng]
  }, [valid])

  if (valid.length === 0) {
    return (
      <div style={{
        minHeight: 380, display: 'grid', placeItems: 'center',
        color: 'var(--muted)', fontSize: '0.875rem',
        background: 'var(--slate-50)', borderRadius: 12,
        textAlign: 'center', padding: '0 24px',
        lineHeight: 1.6,
      }}>
        No GPS coordinates yet.<br />
        <span style={{ fontSize: '0.8125rem' }}>Drivers will appear on the map after their first location update.</span>
      </div>
    )
  }

  return (
    <MapContainer
      center={center}
      zoom={valid.length === 1 ? 13 : 11}
      style={{ height: 420, width: '100%', borderRadius: 12, zIndex: 0 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController markers={valid} selectedId={selectedId} markerRefs={markerRefs} />

      {valid.map((m) => {
        const isSelected = m.id === selectedId
        return (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={makeIcon(isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            ref={(ref) => { if (ref) markerRefs.current[m.id] = ref }}
            eventHandlers={{
              click: () => { if (onSelect) onSelect(m.id) },
            }}
          >
            <Popup>
              <div className="dx-map-popup">
                {/* Header */}
                <div className="dx-map-popup__title">
                  {m.jobId ?? m.label}
                </div>

                {/* Key-value rows */}
                <div className="dx-map-popup__row">
                  <span className="dx-map-popup__label">Driver</span>
                  <span>{m.label ?? '—'}</span>
                </div>
                <div className="dx-map-popup__row">
                  <span className="dx-map-popup__label">Vehicle</span>
                  <span>{m.vehicle ?? '—'}</span>
                </div>
                <div className="dx-map-popup__row">
                  <span className="dx-map-popup__label">Status</span>
                  <span>{fmtStatus(m.status)}</span>
                </div>
                {m.gpsAt && (
                  <div className="dx-map-popup__row">
                    <span className="dx-map-popup__label">Last GPS</span>
                    <span style={{ fontSize: '0.75rem' }}>
                      {new Date(m.gpsAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="dx-map-popup__actions">
                  {m.onViewDetails && (
                    <button
                      type="button"
                      className="dx-map-popup__btn dx-map-popup__btn--primary"
                      onClick={() => m.onViewDetails(m.id)}
                    >
                      View Details
                    </button>
                  )}
                  {m.mapsUrl && (
                    <a
                      href={m.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dx-map-popup__btn dx-map-popup__btn--secondary"
                    >
                      ↗ Maps
                    </a>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

export default LiveFleetMap
