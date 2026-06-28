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
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

const DEFAULT_CENTER = [14.5995, 120.9842]
const NORMAL_SIZE = 26
const SELECTED_SIZE = 34

// ── Custom icon factory ────────────────────────────────────────────────────
function makeIcon(isSelected, kind = 'driver') {
  const size = isSelected ? SELECTED_SIZE : NORMAL_SIZE
  const pinClass = [
    'dx-map-pin',
    kind === 'destination' ? 'dx-map-pin--destination' : '',
    isSelected ? 'dx-map-pin--selected' : '',
  ].filter(Boolean).join(' ')

  return L.divIcon({
    className: '',
    html: `<div class="${pinClass}"></div>`,
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
function LiveFleetMap({ markers = [], selectedId = null, onSelect, routeLines = [] }) {
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

  const validRouteLines = useMemo(
    () =>
      routeLines.filter((line) =>
        Number.isFinite(line?.from?.lat) &&
        Number.isFinite(line?.from?.lng) &&
        Number.isFinite(line?.to?.lat) &&
        Number.isFinite(line?.to?.lng),
      ),
    [routeLines],
  )

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

      {validRouteLines.map((line) => (
        <Polyline
          key={line.id}
          positions={[
            [line.from.lat, line.from.lng],
            [line.to.lat, line.to.lng],
          ]}
          pathOptions={{
            color: '#2563eb',
            weight: 3,
            opacity: 0.75,
            dashArray: '6 8',
          }}
        />
      ))}

      {valid.map((m) => {
        const isSelected = m.id === selectedId
        const markerKind = m.kind ?? 'driver'
        const popupTitle = markerKind === 'destination' ? (m.jobId ?? 'Delivery Destination') : (m.jobId ?? m.label)
        return (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={makeIcon(isSelected, markerKind)}
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
                  {popupTitle}
                </div>

                {markerKind === 'destination' ? (
                  <>
                    <div className="dx-map-popup__row">
                      <span className="dx-map-popup__label">Customer</span>
                      <span>{m.customerName ?? '—'}</span>
                    </div>
                    <div className="dx-map-popup__row">
                      <span className="dx-map-popup__label">Address</span>
                      <span>{m.address ?? '—'}</span>
                    </div>
                    <div className="dx-map-popup__row">
                      <span className="dx-map-popup__label">Job Order</span>
                      <span>{m.jobId ?? '—'}</span>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
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
                      ↗ OpenStreetMap
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

function LiveFleetMapWithUnavailableMessage(props) {
  const { unavailableMessage } = props
  return (
    <>
      <LiveFleetMap {...props} />
      {unavailableMessage ? (
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {unavailableMessage}
        </p>
      ) : null}
    </>
  )
}

export default LiveFleetMapWithUnavailableMessage
