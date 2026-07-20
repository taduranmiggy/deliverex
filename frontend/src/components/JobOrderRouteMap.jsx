/**
 * JobOrderRouteMap — pickup + destination markers with routed polyline (Leaflet + OSM).
 */
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../components/LiveFleetMap.css'
import { fetchJobOrderMap } from '../api/jobOrders'
import { reportRenderedLocation } from '../api/geocoding'
import useAuth from '../hooks/useAuth'
import { AlertTriangle, Loader2, MapPin, Navigation } from 'lucide-react'

const DEFAULT_CENTER = [14.5995, 120.9842]
const PICKUP_COLOR = '#16a34a'
const DEST_COLOR = '#dc2626'
const ROUTE_COLOR = '#2563eb'
const MAP_UNAVAILABLE_MSG = 'Unable to display map for this job order. Please verify the pickup or destination address.'

const ROUTE_SOURCE_LABELS = {
  openrouteservice: 'Road route (OpenRouteService)',
  osrm: 'Road route (OSRM)',
  straight_line: 'Direct estimate (routing unavailable)',
}

function FitBounds({ points, polyline }) {
  const map = useMap()

  useEffect(() => {
    if (polyline?.length > 1) {
      const bounds = L.latLngBounds(polyline)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
        return
      }
    }

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
      }
      return
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
    }
  }, [map, points, polyline])

  return null
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

function makePinIcon(color, label) {
  return L.divIcon({
    className: 'dx-map-icon-wrap',
    html: `<div class="dx-job-route-pin" style="background:${color}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

function formatCoords(point) {
  if (point?.lat == null || point?.lng == null) return '—'
  return `${point.lat.toFixed(7)}, ${point.lng.toFixed(7)}`
}

function buildWarningMessage(geocode, mapUnavailable, partialGeocode) {
  const warnings = geocode?.warnings ?? []
  if (warnings.length > 0) {
    return warnings.join(' ')
  }
  if (partialGeocode) {
    return 'One location could not be mapped. Please verify the pickup or destination address.'
  }
  if (mapUnavailable) {
    return MAP_UNAVAILABLE_MSG
  }
  return MAP_UNAVAILABLE_MSG
}

function RouteInfoPanel({ data, showCoordinates, showWarning, warningMessage, warnings = [] }) {
  const pickup = data?.pickup
  const destination = data?.destination
  const route = data?.route

  return (
    <aside className="dx-job-route-map__info" aria-label="Route details">
      {showWarning && (
        <div className="dx-job-route-map__warn" role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div>
            {warnings.length > 0 ? (
              warnings.map((message) => (
                <p key={message} style={{ margin: 0 }}>{message}</p>
              ))
            ) : (
              <p style={{ margin: 0 }}>{warningMessage || MAP_UNAVAILABLE_MSG}</p>
            )}
          </div>
        </div>
      )}

      <div className="dx-job-route-map__info-row">
        <span className="dx-job-route-map__info-label dx-job-route-map__info-label--pickup">Pickup</span>
        <p className="dx-job-route-map__info-value">{pickup?.address || data?.geocode?.pickup_address || '—'}</p>
        {showCoordinates && pickup?.lat != null && (
          <p className="dx-job-route-map__info-coords">{formatCoords(pickup)}</p>
        )}
      </div>

      <div className="dx-job-route-map__info-row">
        <span className="dx-job-route-map__info-label dx-job-route-map__info-label--dest">Destination</span>
        <p className="dx-job-route-map__info-value">{destination?.address || data?.geocode?.destination_address || '—'}</p>
        {showCoordinates && destination?.lat != null && (
          <p className="dx-job-route-map__info-coords">{formatCoords(destination)}</p>
        )}
      </div>

      <div className="dx-job-route-map__info-metrics">
        <div className="dx-job-route-map__metric">
          <Navigation size={14} aria-hidden />
          <span>Distance</span>
          <strong>{route?.distance_label ?? '—'}</strong>
        </div>
        <div className="dx-job-route-map__metric">
          <MapPin size={14} aria-hidden />
          <span>Est. travel time</span>
          <strong>{route?.duration_label ?? '—'}</strong>
        </div>
      </div>

      {route?.source && (
        <p className="dx-job-route-map__route-source">
          {ROUTE_SOURCE_LABELS[route.source] ?? route.source}
        </p>
      )}
    </aside>
  )
}

async function loadMapPayload(jobOrderId) {
  const res = await fetchJobOrderMap(jobOrderId)
  return res?.data ?? res
}

export default function JobOrderRouteMap({
  jobOrderId,
  readOnly = true,
  variant = 'default',
}) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const showCoordinates = user?.role?.name === 'admin'

  useEffect(() => {
    if (!jobOrderId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setData(null)

    loadMapPayload(jobOrderId)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load map.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [jobOrderId])

  useEffect(() => {
    const pointsToReport = [data?.pickup, data?.destination].filter(
      (point) => point?.trace_id && point?.lat != null && point?.lng != null,
    )
    if (pointsToReport.length === 0) return
    void Promise.allSettled(pointsToReport.map((point) => (
      reportRenderedLocation(point.trace_id, point.lat, point.lng)
    )))
  }, [data?.pickup, data?.destination])

  const points = useMemo(() => {
    const items = []
    if (data?.pickup?.lat != null && data?.pickup?.lng != null) items.push(data.pickup)
    if (data?.destination?.lat != null && data?.destination?.lng != null) items.push(data.destination)
    return items
  }, [data])

  const polyline = useMemo(() => {
    const fromRoute = (data?.route?.polyline ?? []).filter((p) => Array.isArray(p) && p.length >= 2)
    if (fromRoute.length > 1) return fromRoute
    if (points.length >= 2) return points.map((p) => [p.lat, p.lng])
    return []
  }, [data, points])

  const geocodeWarnings = data?.geocode?.warnings ?? []
  const hasBothAddresses = Boolean(
    data?.geocode?.pickup_address && data?.geocode?.destination_address,
  )
  const mapUnavailable = !loading && !error && hasBothAddresses && points.length === 0
  const partialGeocode = !loading && !error && hasBothAddresses && points.length === 1
  const showWarning = mapUnavailable || partialGeocode || geocodeWarnings.length > 0
  const warningMessage = buildWarningMessage(data?.geocode, mapUnavailable, partialGeocode)

  if (loading) {
    return (
      <div className={`dx-job-route-map dx-job-route-map--${variant} dx-job-route-map--loading`} aria-busy="true">
        <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
        <span>Loading route map…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`dx-job-route-map dx-job-route-map--${variant}`}>
        <div className="dx-job-route-map__layout">
          <div className="dx-job-route-map__stage dx-job-route-map__stage--empty dx-job-route-map--error">
            {error}
          </div>
          {data && (
            <RouteInfoPanel
              data={data}
              showCoordinates={showCoordinates}
              showWarning
              warningMessage={warningMessage}
              warnings={geocodeWarnings}
            />
          )}
        </div>
      </div>
    )
  }

  const center = points.length > 0
    ? [
        points.reduce((sum, p) => sum + p.lat, 0) / points.length,
        points.reduce((sum, p) => sum + p.lng, 0) / points.length,
      ]
    : DEFAULT_CENTER

  return (
    <div className={`dx-job-route-map dx-job-route-map--${variant}`}>
      <div className="dx-job-route-map__layout">
        <div className="dx-job-route-map__map-col">
          {mapUnavailable ? (
            <div
              className="dx-job-route-map__stage dx-job-route-map__stage--empty dx-job-route-map__stage--unavailable"
              aria-hidden="true"
            />
          ) : (
            <div className="dx-job-route-map__stage">
              <MapContainer
                key={`job-route-map-${jobOrderId}`}
                center={center}
                zoom={12}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapInvalidateSize layoutKey={`${variant}-${points.length}`} />
                <FitBounds points={points} polyline={polyline} />

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
                  <Marker
                    position={[data.destination.lat, data.destination.lng]}
                    icon={makePinIcon(DEST_COLOR, 'D')}
                  >
                    <Popup>
                      <strong>Destination</strong>
                      <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>{data.destination.address || '—'}</div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          )}

          {!mapUnavailable && readOnly && points.length > 0 && (
            <div className="dx-job-route-map__map-footer">
              <span className="dx-job-route-map__legend-item">
                <span className="dx-job-route-map__dot dx-job-route-map__dot--pickup" /> Pickup
              </span>
              <span className="dx-job-route-map__legend-item">
                <span className="dx-job-route-map__dot dx-job-route-map__dot--dest" /> Destination
              </span>
            </div>
          )}
        </div>

        <RouteInfoPanel
          data={data}
          showCoordinates={showCoordinates}
          showWarning={showWarning}
          warningMessage={warningMessage}
          warnings={geocodeWarnings}
        />
      </div>
    </div>
  )
}
