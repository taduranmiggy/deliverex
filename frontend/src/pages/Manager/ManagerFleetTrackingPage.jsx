import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/client'
import LiveFleetMap from '../../components/LiveFleetMap'
import { PageHeader, StatusBadge } from '../../components/ui'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'

function fetchActiveDeliveries() {
  return apiRequest('/manager/active-deliveries')
}

function parseCoordinate(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function buildOsmCoordinateUrl(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}

function ManagerFleetTrackingPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const res = await fetchActiveDeliveries()
      setRows(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) {
        load()
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [load])

  const { markers, routeLines, historyPolylines, unavailableMessage } = useMemo(() => {
    const items = []
    const lines = []
    const histories = []
    let missingDriverGps = false

    rows.forEach((r) => {
      const jobPublicId = r.job_order ? formatJobPublicId(r.job_order.id) : `#${r.id}`
      const dropoffLat = parseCoordinate(r.job_order?.dropoff_latitude)
      const dropoffLng = parseCoordinate(r.job_order?.dropoff_longitude)
      const destinationAddress = buildDisplayAddress('dropoff', r.job_order) || r.job_order?.dropoff_location || '—'
      const destinationAvailable = Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)

      if (destinationAvailable) {
        items.push({
          id: `destination-${r.id}`,
          kind: 'destination',
          lat: dropoffLat,
          lng: dropoffLng,
          jobId: jobPublicId,
          trackingId: r.job_order?.tracking_code ?? null,
          customerName: buildDisplayName(r.job_order) || '—',
          address: destinationAddress,
          mapsUrl: buildOsmCoordinateUrl(dropoffLat, dropoffLng),
        })
      }

      if (r.gps && Number.isFinite(r.gps.lat) && Number.isFinite(r.gps.lng)) {
        items.push({
          id: r.id,
          kind: 'driver',
          lat: r.gps.lat,
          lng: r.gps.lng,
          label: r.driver ?? 'Driver',
          sublabel: jobPublicId,
          jobId: jobPublicId,
          trackingId: r.job_order?.tracking_code ?? null,
          vehicle: r.vehicle ?? '—',
          status: r.status,
          gpsAt: r.gps.at,
          gpsSyncedAt: r.gps.synced_at,
          gpsPerformedOffline: r.gps.performed_offline,
          speedKmh: r.gps.speed_kmh,
          isOffline: r.gps.is_stale || r.gps.is_critical_stale,
          mapsUrl: buildOsmCoordinateUrl(r.gps.lat, r.gps.lng),
        })

        if (Array.isArray(r.route_history) && r.route_history.length > 1) {
          histories.push({
            id: `history-${r.id}`,
            positions: r.route_history.map((point) => [point.lat, point.lng]),
          })
        }

        if (destinationAvailable) {
          lines.push({
            id: `line-${r.id}`,
            from: { lat: r.gps.lat, lng: r.gps.lng },
            to: { lat: dropoffLat, lng: dropoffLng },
          })
        }
      } else if (destinationAvailable) {
        missingDriverGps = true
      }
    })

    return {
      markers: items,
      routeLines: lines,
      historyPolylines: histories,
      unavailableMessage: missingDriverGps ? 'Driver location is currently unavailable.' : '',
    }
  }, [rows])

  return (
    <>
      <PageHeader title="Fleet Tracking" subtitle="Latest driver updates and last reported status">
        <button type="button" className="btn-dx-secondary btn-sm" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.7s linear infinite' } : {}} />
          Refresh
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ marginBottom: 20 }}>
        <h3 className="dx-panel-title">Last Known Locations</h3>
        <LiveFleetMap markers={markers} routeLines={routeLines} historyPolylines={historyPolylines} unavailableMessage={unavailableMessage} loading={refreshing && rows.length === 0} />
      </div>

      <div className="dx-panel">
        <h3 className="dx-panel-title">Active deliveries ({rows.length})</h3>
        {rows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No active deliveries.</p>
        ) : (
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr><th>Job</th><th>Driver</th><th>Vehicle</th><th>Status</th><th>GPS</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.job_order ? formatJobPublicId(r.job_order.id) : `#${r.id}`}</td>
                    <td>{r.driver ?? '—'}</td>
                    <td>{r.vehicle ?? '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {r.gps ? `${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)}` : '—'}
                    </td>
                    <td>
                      {r.gps && (
                        <a href={buildOsmCoordinateUrl(r.gps.lat, r.gps.lng)} target="_blank" rel="noopener noreferrer" className="btn-dx-secondary btn-sm">
                          <ExternalLink size={12} /> OpenStreetMap
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

export default ManagerFleetTrackingPage
