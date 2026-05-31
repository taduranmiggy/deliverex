import { useEffect, useMemo, useState } from 'react'
import { fetchAssignments } from '../../api/dispatcher'
import { fetchTrackingLogs } from '../../api/tracking'
import LiveFleetMap from '../../components/LiveFleetMap'
import { PageHeader, StatusBadge } from '../../components/ui'
import { Car, ExternalLink, MapPin, RefreshCw } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'

function formatGpsTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function DeliveryMonitoringPage() {
  const [assignments, setAssignments] = useState([])
  const [gpsMap, setGpsMap] = useState({})
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const res = await fetchAssignments(1)
      const active = (res.data || []).filter((a) => !['completed', 'cancelled'].includes(a.status))
      setAssignments(active)
      const entries = await Promise.allSettled(
        active.map((a) =>
          fetchTrackingLogs(a.id, 1)
            .then((r) => {
              const last = r.data?.[0]
              return last ? [a.id, { lat: Number(last.latitude), lng: Number(last.longitude), at: last.captured_at }] : null
            })
            .catch(() => null),
        ),
      )
      const map = {}
      entries.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          const [id, coords] = r.value
          map[id] = coords
        }
      })
      setGpsMap(map)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const mapMarkers = useMemo(
    () => assignments
      .map((a) => {
        const gps = gpsMap[a.id]
        if (!gps) return null
        return {
          id: a.id,
          lat: gps.lat,
          lng: gps.lng,
          label: a.driver?.user?.name ?? 'Driver',
          sublabel: `${formatJobPublicId(a.job_order_id)} · ${a.status}`,
        }
      })
      .filter(Boolean),
    [assignments, gpsMap],
  )

  return (
    <>
      <PageHeader title="Tracking" subtitle="Latest driver updates and last reported status">
        <button type="button" className="btn-dx-secondary btn-sm" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.7s linear infinite' } : {}} />
          Refresh
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit">
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Last Known Locations</h3>
          <LiveFleetMap markers={mapMarkers} />
        </div>

        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h3 className="dx-panel-title" style={{ margin: 0 }}>Active Deliveries</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{assignments.length} active</span>
          </div>
          <div className="dx-driver-cards" style={{ maxHeight: 420 }}>
            {assignments.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '32px 0' }}>No active deliveries.</p>
            ) : (
              assignments.map((a) => {
                const gps = gpsMap[a.id]
                const mapsUrl = gps
                  ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.job_order?.dropoff_location ?? '')}`
                return (
                  <div key={a.id} className="dx-driver-card-dx">
                    <header>
                      <strong style={{ fontSize: '0.875rem' }}>{a.driver?.user?.name ?? 'Driver'}</strong>
                      <StatusBadge status={a.status} />
                    </header>
                    <div className="dx-driver-muted" style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600 }}>Job {formatJobPublicId(a.job_order_id)}</div>
                      <div style={{ marginTop: 3 }}>{a.job_order?.pickup_location} → {a.job_order?.dropoff_location}</div>
                      <div style={{ marginTop: 6, fontSize: '0.8125rem' }}>
                        <strong>Last Reported Status:</strong> {a.status?.replace(/_/g, ' ') ?? '—'}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} />
                        {gps ? `Last Known Location: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'No location reported yet'}
                      </div>
                      {gps?.at && (
                        <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                          Last Updated: {formatGpsTime(gps.at)}
                        </div>
                      )}
                      <div style={{ marginTop: 3 }}><Car size={12} style={{ display: 'inline', marginRight: 4 }} />{a.vehicle?.plate_no}</div>
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-dx-secondary btn-sm" style={{ marginTop: 8, display: 'inline-flex', gap: 4 }}>
                        <ExternalLink size={12} /> Open in Maps
                      </a>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default DeliveryMonitoringPage
