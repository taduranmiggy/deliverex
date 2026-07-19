/**
 * LiveFleetMap — Leaflet map with two-way card ↔ pin sync.
 *
 * Props:
 *   markers    — array of marker data (see shape below)
 *   selectedId — id of the currently selected marker (controlled by parent)
 *   onSelect   — callback(id) when a pin is clicked
 *   routeLines — driver → destination polylines
 *   loading    — show skeleton while map data is loading
 *   unavailableMessage — banner when driver GPS is missing but destination exists
 *
 * Marker shape:
 *   { id, lat, lng, kind: 'driver' | 'destination', label, sublabel,
 *     jobId, trackingId, vehicle, status, gpsAt, gpsSyncedAt, gpsPerformedOffline,
 *     customerName, address, mapsUrl, onViewDetails }
 */
import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './LiveFleetMap.css'
import AnimatedDriverMarker from './AnimatedDriverMarker'
import { formatEventAt, formatOfflineSyncLabel, formatSyncedAt } from '../utils/deliveryTimestamps'
import { gpsColorForStatus, GPS_STATUS_COLORS } from '../utils/gpsStatusColors'
import { formatDriverGpsAge, isDriverOffline } from '../utils/fleetLiveSync'
import { Crosshair, Minus, Plus, RotateCcw } from 'lucide-react'

const DEFAULT_CENTER = [14.5995, 120.9842]
const PICKUP_COLOR = '#059669'
const DEST_COLOR = '#dc2626'
const TRUCK_SIZE = 34
const TRUCK_SIZE_SELECTED = 40
const DEST_SIZE = 30
const DEST_SIZE_SELECTED = 36

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 13.52 9H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`

const DEST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`

function makeTruckIcon(isSelected, color = GPS_STATUS_COLORS.en_route_to_destination) {
  const size = isSelected ? TRUCK_SIZE_SELECTED : TRUCK_SIZE
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-map-truck${isSelected ? ' dx-map-truck--selected' : ''}" style="width:${size}px;height:${size}px;color:${color}">${TRUCK_SVG}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4],
  })
}

function makeDestinationIcon(isSelected) {
  const size = isSelected ? DEST_SIZE_SELECTED : DEST_SIZE
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-map-destination${isSelected ? ' dx-map-destination--selected' : ''}" style="width:${size}px;height:${size}px;color:${DEST_COLOR}">${DEST_SVG}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4],
  })
}

function makePickupIcon(isSelected) {
  const size = isSelected ? DEST_SIZE_SELECTED : DEST_SIZE
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-map-destination${isSelected ? ' dx-map-destination--selected' : ''}" style="width:${size}px;height:${size}px;color:${PICKUP_COLOR}">${DEST_SVG}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4],
  })
}

function makeIcon(isSelected, kind = 'driver', status) {
  if (kind === 'destination') return makeDestinationIcon(isSelected)
  if (kind === 'pickup') return makePickupIcon(isSelected)
  return makeTruckIcon(isSelected, gpsColorForStatus(status))
}

function fmtStatus(s) {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function markerBelongsToAssignment(markerId, assignmentId) {
  if (assignmentId == null || markerId == null) return false
  const key = String(assignmentId)
  const id = String(markerId)
  return id === key || id === `pickup-${key}` || id === `destination-${key}`
}

function resolveTrackingContext(markers, selectedAssignmentId) {
  let driver = null
  let pickup = null
  let destination = null

  if (selectedAssignmentId != null) {
    const key = String(selectedAssignmentId)
    driver = markers.find((m) => m.kind === 'driver' && String(m.id) === key) ?? null
    pickup = markers.find((m) => m.id === `pickup-${key}`) ?? null
    destination = markers.find((m) => m.id === `destination-${key}`) ?? null
  } else {
    const drivers = markers.filter((m) => m.kind === 'driver')
    const destinations = markers.filter((m) => m.kind === 'destination')
    if (drivers.length === 1) {
      driver = drivers[0]
      destination = destinations.find((d) => d.id === `destination-${driver.id}`) ?? destinations[0] ?? null
      pickup = markers.find((m) => m.id === `pickup-${driver.id}`) ?? null
    } else if (drivers.length === 0 && destinations.length === 1) {
      destination = destinations[0]
      const assignmentKey = String(destination.id).replace(/^destination-/, '')
      pickup = markers.find((m) => m.id === `pickup-${assignmentKey}`) ?? null
    }
  }

  return {
    driver,
    pickup,
    destination,
    visible: Boolean(driver || pickup || destination),
  }
}

function formatLastGpsUpdate(marker) {
  if (!marker?.gpsAt) return null
  const row = {
    event_at: marker.gpsAt,
    synced_at: marker.gpsSyncedAt ?? null,
    performed_offline: marker.gpsPerformedOffline ?? false,
  }
  const timeOpts = { hour: 'numeric', minute: '2-digit' }
  const eventLabel = formatEventAt(row, undefined, timeOpts)
  const offlineLabel = formatOfflineSyncLabel(row, undefined, timeOpts)
  const syncedOnly = formatSyncedAt(row, undefined, timeOpts)

  return {
    eventLabel,
    offlineLabel,
    syncedOnly,
    isOffline: Boolean(marker.gpsPerformedOffline || marker.gpsSyncedAt),
  }
}

function MapInvalidateSize({ layoutKey }) {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize({ pan: false })
      })
    }

    const timer = window.setTimeout(invalidate, 120)
    const container = map.getContainer()?.parentElement
    const observer = container && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(invalidate)
      : null
    observer?.observe(container)
    window.addEventListener('resize', invalidate)

    return () => {
      window.clearTimeout(timer)
      observer?.disconnect()
      window.removeEventListener('resize', invalidate)
    }
  }, [map, layoutKey])

  return null
}

function AutoFitBounds({ markers, routeLines, selectedAssignmentId }) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.latLngBounds([])
    let relevant = markers

    if (selectedAssignmentId != null) {
      relevant = markers.filter((m) => markerBelongsToAssignment(m.id, selectedAssignmentId))
    }

    relevant.forEach((m) => bounds.extend([m.lat, m.lng]))

    const relevantLineIds = selectedAssignmentId != null
      ? new Set([
          `line-${selectedAssignmentId}`,
          `delivery-route-${selectedAssignmentId}`,
        ])
      : null

    routeLines.forEach((line) => {
      if (relevantLineIds && !relevantLineIds.has(String(line.id))) return
      if (Array.isArray(line.polyline) && line.polyline.length > 0) {
        line.polyline.forEach((p) => bounds.extend(p))
      } else if (Number.isFinite(line?.from?.lat) && Number.isFinite(line?.to?.lat)) {
        bounds.extend([line.from.lat, line.from.lng])
        bounds.extend([line.to.lat, line.to.lng])
      }
    })

    if (!bounds.isValid()) return

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true })
  }, [map, markers, routeLines, selectedAssignmentId])

  return null
}

function MapController({ markers, selectedAssignmentId, markerRefs, initialViewRef }) {
  const map = useMap()

  useEffect(() => {
    if (!initialViewRef.current) {
      initialViewRef.current = {
        center: map.getCenter(),
        zoom: map.getZoom(),
      }
    }
  }, [map, initialViewRef])

  useEffect(() => {
    if (selectedAssignmentId == null) return

    const relevant = markers.filter((m) => markerBelongsToAssignment(m.id, selectedAssignmentId))
    if (relevant.length === 0) return

    if (relevant.length === 1) {
      const [only] = relevant
      map.flyTo([only.lat, only.lng], Math.max(map.getZoom(), 14), { duration: 0.7, easeLinearity: 0.5 })
    }

    const openId = relevant.find((m) => m.kind === 'driver')?.id
      ?? relevant.find((m) => m.kind === 'pickup')?.id
      ?? relevant[0]?.id

    const timer = window.setTimeout(() => {
      const ref = openId ? markerRefs.current[openId] : null
      if (ref) ref.openPopup()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [selectedAssignmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function MapToolbar({ markers, routeLines, initialViewRef }) {
  const map = useMap()

  const fitRoute = () => {
    const bounds = L.latLngBounds([])
    markers.forEach((m) => bounds.extend([m.lat, m.lng]))
    routeLines.forEach((line) => {
      if (Array.isArray(line.polyline) && line.polyline.length > 0) {
        line.polyline.forEach((p) => bounds.extend(p))
      } else {
        bounds.extend([line.from.lat, line.from.lng])
        bounds.extend([line.to.lat, line.to.lng])
      }
    })
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 })
    }
  }

  const resetView = () => {
    const initial = initialViewRef.current
    if (initial) {
      map.setView(initial.center, initial.zoom)
      return
    }
    map.setView(DEFAULT_CENTER, 11)
  }

  return (
    <div className="dx-fleet-map-controls" aria-label="Map controls">
      <button type="button" className="dx-fleet-map-controls__btn dx-fleet-map-controls__btn--wide" onClick={fitRoute} title="Fit to route">
        <Crosshair size={16} aria-hidden />
        <span>Fit</span>
      </button>
      <button type="button" className="dx-fleet-map-controls__btn" onClick={() => map.zoomIn()} title="Zoom in" aria-label="Zoom in">
        <Plus size={16} aria-hidden />
      </button>
      <button type="button" className="dx-fleet-map-controls__btn" onClick={() => map.zoomOut()} title="Zoom out" aria-label="Zoom out">
        <Minus size={16} aria-hidden />
      </button>
      <button type="button" className="dx-fleet-map-controls__btn" onClick={resetView} title="Reset view" aria-label="Reset view">
        <RotateCcw size={15} aria-hidden />
      </button>
    </div>
  )
}

function MapLegend() {
  return (
    <div className="dx-fleet-map-legend" aria-label="Map legend">
      <div className="dx-fleet-map-legend__item">
        <span className="dx-fleet-map-legend__swatch" style={{ color: GPS_STATUS_COLORS.en_route_to_destination }} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
        </span>
        <span>Driver</span>
      </div>
      <div className="dx-fleet-map-legend__item">
        <span className="dx-fleet-map-legend__swatch" style={{ color: PICKUP_COLOR }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
        </span>
        <span>Pickup</span>
      </div>
      <div className="dx-fleet-map-legend__item">
        <span className="dx-fleet-map-legend__swatch" style={{ color: '#dc2626' }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
        </span>
        <span>Destination</span>
      </div>
      <div className="dx-fleet-map-legend__item">
        <span className="dx-fleet-map-legend__swatch dx-fleet-map-legend__swatch--route" aria-hidden />
        <span>Route</span>
      </div>
    </div>
  )
}

function DriverInfoPanel({ marker, destinationMarker }) {
  if (!marker && !destinationMarker) return null

  const gpsUpdate = marker ? formatLastGpsUpdate(marker) : null
  const driverOffline = marker
    ? isDriverOffline({ at: marker.gpsAt, offline: marker.offline, is_stale: marker.isOffline })
    : false

  return (
    <aside className="dx-fleet-map-info" aria-label="Delivery tracking details">
      <h4 className="dx-fleet-map-info__title">Tracking Details</h4>

      {driverOffline && marker?.gpsAt && (
        <div className="dx-fleet-offline-banner" role="status">
          <strong>Driver Offline</strong>
          <span>Last GPS received: {formatDriverGpsAge(marker.gpsAt)}</span>
        </div>
      )}

      {marker ? (
        <>
          <div className="dx-fleet-map-info__row">
            <span className="dx-fleet-map-info__label">Driver</span>
            <span className="dx-fleet-map-info__value">{marker.label ?? '—'}</span>
          </div>
          <div className="dx-fleet-map-info__row">
            <span className="dx-fleet-map-info__label">Vehicle</span>
            <span className="dx-fleet-map-info__value">{marker.vehicle ?? '—'}</span>
          </div>
          <div className="dx-fleet-map-info__row">
            <span className="dx-fleet-map-info__label">Current Status</span>
            <span className="dx-fleet-map-info__value">{fmtStatus(marker.status)}</span>
          </div>
        </>
      ) : (
        <div className="dx-fleet-map-info__row">
          <span className="dx-fleet-map-info__label">Driver</span>
          <span className="dx-fleet-map-info__value dx-fleet-map-info__value--muted">Location unavailable</span>
        </div>
      )}

      <div className="dx-fleet-map-info__row">
        <span className="dx-fleet-map-info__label">Tracking ID</span>
        <span className="dx-fleet-map-info__value">{marker?.trackingId ?? destinationMarker?.trackingId ?? '—'}</span>
      </div>

      {marker?.jobId || destinationMarker?.jobId ? (
        <div className="dx-fleet-map-info__row">
          <span className="dx-fleet-map-info__label">Job Order</span>
          <span className="dx-fleet-map-info__value">{marker?.jobId ?? destinationMarker?.jobId}</span>
        </div>
      ) : null}

      {marker?.gpsAt && (
        <>
          <div className="dx-fleet-map-info__row">
            <span className="dx-fleet-map-info__label">Last Updated</span>
            <span className="dx-fleet-map-info__value">{gpsUpdate?.eventLabel ?? '—'}</span>
          </div>
          {Number.isFinite(marker.speedKmh) && (
            <div className="dx-fleet-map-info__row">
              <span className="dx-fleet-map-info__label">Speed</span>
              <span className="dx-fleet-map-info__value">{marker.speedKmh.toFixed(1)} km/h</span>
            </div>
          )}
          {marker.isOffline && (
            <div className="dx-fleet-map-info__row">
              <span className="dx-fleet-map-info__label">Connection</span>
              <span className="dx-fleet-map-info__value dx-fleet-map-info__value--muted">Driver Offline</span>
            </div>
          )}
        </>
      )}

      {!marker?.gpsAt && (
        <div className="dx-fleet-map-info__row">
          <span className="dx-fleet-map-info__label">Last Updated</span>
          <span className="dx-fleet-map-info__value dx-fleet-map-info__value--muted">—</span>
        </div>
      )}

      {marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng) ? (
        <div className="dx-fleet-map-info__row">
          <span className="dx-fleet-map-info__label">Coordinates</span>
          <span className="dx-fleet-map-info__value dx-fleet-map-info__value--muted">
            {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
          </span>
        </div>
      ) : null}
    </aside>
  )
}

function MapSkeleton() {
  return (
    <div className="dx-fleet-map-skeleton" aria-busy="true" aria-label="Loading map">
      <div className="dx-fleet-map-skeleton__bar dx-fleet-map-skeleton__bar--short" />
      <div className="dx-fleet-map-skeleton__bar dx-fleet-map-skeleton__bar--mid" />
      <div className="dx-fleet-map-skeleton__map" />
    </div>
  )
}

function LiveFleetMap({
  markers = [],
  selectedId = null,
  selectedAssignmentId = null,
  onSelect,
  routeLines = [],
  historyPolylines = [],
  loading = false,
  hasActiveDeliveries = false,
  locationWarnings = [],
}) {
  const markerRefs = useRef({})
  const initialViewRef = useRef(null)
  const activeAssignmentId = selectedAssignmentId ?? selectedId

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

  const initialZoom = valid.length <= 1 ? 13 : 11

  const validHistoryPolylines = useMemo(
    () =>
      historyPolylines.filter((line) =>
        Array.isArray(line?.positions) &&
        line.positions.length > 1 &&
        line.positions.every((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1])),
      ),
    [historyPolylines],
  )

  const validRouteLines = useMemo(
    () =>
      routeLines.filter((line) =>
        (Array.isArray(line?.polyline) && line.polyline.length > 1) ||
        (Number.isFinite(line?.from?.lat) &&
          Number.isFinite(line?.from?.lng) &&
          Number.isFinite(line?.to?.lat) &&
          Number.isFinite(line?.to?.lng)),
      ),
    [routeLines],
  )

  const trackingContext = useMemo(
    () => resolveTrackingContext(valid, activeAssignmentId),
    [valid, activeAssignmentId],
  )

  const { driver: driverMarker, destination: destinationMarker, visible: showInfoPanel } = trackingContext
  const layoutKey = showInfoPanel ? 'with-panel' : 'full'

  if (loading && valid.length === 0) {
    return <MapSkeleton />
  }

  if (valid.length === 0) {
    return (
      <div className="dx-fleet-map-empty">
        {hasActiveDeliveries ? (
          <>
            Map markers could not be rendered for the active deliveries.
            <br />
            <span style={{ fontSize: '0.8125rem' }}>
              Check the location warnings above for missing pickup, destination, or driver GPS data.
            </span>
          </>
        ) : (
          <>
            No active deliveries to track.
            <br />
            <span style={{ fontSize: '0.8125rem' }}>
              Assigned drivers will appear here once deliveries are in progress.
            </span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`dx-fleet-map-layout${showInfoPanel ? ' dx-fleet-map-layout--with-panel' : ''}`}>
      <div className="dx-fleet-map-stage">
        <MapContainer
          center={center}
          zoom={initialZoom}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapInvalidateSize layoutKey={layoutKey} />
          <AutoFitBounds
            markers={valid}
            routeLines={validRouteLines}
            selectedAssignmentId={activeAssignmentId}
          />
          <MapController
            markers={valid}
            selectedAssignmentId={activeAssignmentId}
            markerRefs={markerRefs}
            initialViewRef={initialViewRef}
          />
          <MapToolbar markers={valid} routeLines={validRouteLines} initialViewRef={initialViewRef} />

          {validHistoryPolylines.map((line) => (
            <Polyline
              key={line.id}
              positions={line.positions}
              pathOptions={{
                color: '#64748b',
                weight: 3,
                opacity: 0.65,
                dashArray: '6 8',
              }}
            />
          ))}

          {validRouteLines.map((line) => {
            const positions = Array.isArray(line.polyline) && line.polyline.length > 1
              ? line.polyline
              : [[line.from.lat, line.from.lng], [line.to.lat, line.to.lng]]
            const color = line.color ?? gpsColorForStatus(line.status)

            return (
              <Polyline
                key={line.id}
                positions={positions}
                pathOptions={{
                  color,
                  weight: line.dashed ? 3 : 4.5,
                  opacity: line.dashed ? 0.72 : 0.88,
                  dashArray: line.dashed ? '8 10' : undefined,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )
          })}

          {valid.map((m) => {
            const isSelected = markerBelongsToAssignment(m.id, activeAssignmentId)
            const markerKind = m.kind ?? 'driver'
            const popupTitle = markerKind === 'destination'
              ? 'Delivery Destination'
              : markerKind === 'pickup'
                ? 'Pickup Location'
                : (m.label ?? 'Driver')
            const MarkerComponent = markerKind === 'driver' ? AnimatedDriverMarker : Marker
            const markerProps = {
              key: m.id,
              position: [m.lat, m.lng],
              icon: makeIcon(isSelected, markerKind, m.status),
              zIndexOffset: isSelected ? 1000 : markerKind === 'driver' ? 500 : markerKind === 'pickup' ? 80 : 100,
              ref: markerKind !== 'driver'
                ? (ref) => { if (ref) markerRefs.current[m.id] = ref }
                : undefined,
              markerRef: markerKind === 'driver' ? markerRefs : undefined,
              id: m.id,
              eventHandlers: {
                click: () => { if (onSelect) onSelect(m.id) },
              },
            }

            return (
              <MarkerComponent {...markerProps}>
                <Popup>
                  <div className={`dx-map-popup${markerKind === 'destination' ? ' dx-map-popup--destination' : ''}`}>
                    <div className="dx-map-popup__title">{popupTitle}</div>

                    {markerKind === 'destination' || markerKind === 'pickup' ? (
                      <>
                        <div className="dx-map-popup__row">
                          <span className="dx-map-popup__label">{markerKind === 'pickup' ? 'Pickup' : 'Customer'}</span>
                          <span>{markerKind === 'destination' ? (m.customerName ?? '—') : (m.address ?? '—')}</span>
                        </div>
                        <div className="dx-map-popup__row">
                          <span className="dx-map-popup__label">Address</span>
                          <span>{m.address ?? '—'}</span>
                        </div>
                        <div className="dx-map-popup__row">
                          <span className="dx-map-popup__label">Tracking ID</span>
                          <span>{m.trackingId ?? '—'}</span>
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
                        {m.trackingId && (
                          <div className="dx-map-popup__row">
                            <span className="dx-map-popup__label">Tracking ID</span>
                            <span>{m.trackingId}</span>
                          </div>
                        )}
                        {m.gpsAt && (
                          <div className="dx-map-popup__row">
                            <span className="dx-map-popup__label">Last GPS</span>
                            <span style={{ fontSize: '0.75rem' }}>
                              {formatEventAt({ event_at: m.gpsAt }, undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                      </>
                    )}

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
              </MarkerComponent>
            )
          })}
        </MapContainer>

        <MapLegend />
      </div>

      {showInfoPanel ? (
        <DriverInfoPanel marker={driverMarker} destinationMarker={destinationMarker} />
      ) : null}
    </div>
  )
}

function LiveFleetMapWithUnavailableMessage(props) {
  const { unavailableMessage, locationWarnings = [] } = props
  return (
    <>
      <LiveFleetMap {...props} />
      {unavailableMessage ? (
        <p className="dx-fleet-map-unavailable" role="status">
          {unavailableMessage}
        </p>
      ) : null}
      {locationWarnings.length > 0 && import.meta.env.DEV ? (
        <p className="dx-fleet-map-unavailable" role="status">
          {locationWarnings.length} location warning{locationWarnings.length === 1 ? '' : 's'} logged to the browser console.
        </p>
      ) : null}
    </>
  )
}

export default LiveFleetMapWithUnavailableMessage
