import { useEffect, useMemo, useState } from 'react'
import { fetchAssignments } from '../../api/dispatcher'
import { fetchTrackingLogs } from '../../api/tracking'
import { PageHeader, SectionCard, StatusBadge } from '../../components/ui'
import { Car, MapPin, RefreshCw } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'

function DeliveryMonitoringPage() {
  const [assignments, setAssignments] = useState([])
  const [gpsMap, setGpsMap]           = useState({})
  const [error, setError]             = useState('')
  const [refreshing, setRefreshing]   = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const res = await fetchAssignments(1)
      const active = (res.data || []).filter((a) => !['completed', 'cancelled'].includes(a.status))
      setAssignments(active)
      const entries = await Promise.allSettled(
        active.map((a) =>
          fetchTrackingLogs(a.id, 1)
            .then((r) => { const last = r.data?.[0]; return last ? [a.id, { lat: last.latitude, lng: last.longitude, at: last.captured_at }] : null })
            .catch(() => null)
        )
      )
      const map = {}
      entries.forEach((r) => { if (r.status === 'fulfilled' && r.value) { const [id, coords] = r.value; map[id] = coords } })
      setGpsMap(map)
    } catch (err) { setError(err.message) }
    finally { setRefreshing(false) }
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [])

  const pins = useMemo(() => assignments.slice(0, 8).map((a, i) => {
    const gps = gpsMap[a.id]
    if (gps) {
      const latNorm = Math.min(Math.max((Number(gps.lat) - 14.0) / 2.0, 0.05), 0.95)
      const lngNorm = Math.min(Math.max((Number(gps.lng) - 120.5) / 1.5, 0.05), 0.95)
      return { left: Math.round(lngNorm * 80 + 5), top: Math.round((1 - latNorm) * 70 + 5), real: true }
    }
    return { left: 8 + i * 12, top: 15 + ((i * 19) % 65), real: false }
  }), [assignments, gpsMap])

  const gpsCount = Object.keys(gpsMap).length

  return (
    <>
      <PageHeader title="Live Tracking" subtitle={`Real-time driver locations · auto-refresh every 20 s · ${gpsCount} with GPS`}>
        <button type="button" className="btn-dx-secondary btn-sm" onClick={load} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.7s linear infinite' } : {}} />
          Refresh
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit">
        {/* Map */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Live Map</h3>
          <div className="dx-live-map-shell" style={{ minHeight: 440 }}>
            {/* Grid overlay */}
            {[25, 50, 75].map((pct) => (
              <div key={pct} style={{ position: 'absolute', left: 0, right: 0, top: `${pct}%`, borderTop: '1px dashed rgba(37,99,235,0.1)', pointerEvents: 'none' }} />
            ))}
            {pins.map((pin, i) => (
              <span key={i} style={{ position: 'absolute', left: `${pin.left}%`, top: `${pin.top}%`, transform: 'translate(-50%, -100%)', color: pin.real ? 'var(--color-success)' : 'var(--color-primary)', filter: `drop-shadow(0 2px 4px ${pin.real ? 'rgba(22,163,74,0.4)' : 'rgba(37,99,235,0.35)'})`, cursor: 'pointer' }}
                title={`${assignments[i]?.driver?.user?.name ?? 'Driver'} · ${pin.real ? 'GPS' : 'approx.'}`}
                aria-hidden
              >
                <MapPin size={24} fill="currentColor" />
              </span>
            ))}
            <div className="dx-live-map-msg">
              <strong>{assignments.length} drivers active</strong>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{gpsCount} with GPS</span>
            </div>
          </div>
        </div>

        {/* Driver list */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h3 className="dx-panel-title" style={{ margin: 0 }}>Active Drivers</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{assignments.length} on the road</span>
          </div>
          <div className="dx-driver-cards" style={{ maxHeight: 420 }}>
            {assignments.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '32px 0' }}>No active deliveries.</p>
            ) : assignments.map((a) => {
              const gps = gpsMap[a.id]
              return (
                <div key={a.id} className="dx-driver-card-dx">
                  <header>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="topbar-avatar" style={{ width: 30, height: 30, fontSize: '0.7rem', borderRadius: 8, flexShrink: 0 }}>
                        {(a.driver?.user?.name ?? 'DR').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <strong style={{ fontSize: '0.875rem' }}>{a.driver?.user?.name ?? 'Driver'}</strong>
                    </div>
                    <StatusBadge status={a.status} />
                  </header>
                  <div className="dx-driver-muted" style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem' }}>Job {formatJobPublicId(a.job_order_id)}</div>
                    <div style={{ marginTop: 3 }}>{a.job_order?.pickup_location ?? '—'} → {a.job_order?.dropoff_location ?? '—'}</div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MapPin size={13} style={{ color: gps ? 'var(--color-success)' : 'var(--muted)', flexShrink: 0 }} />
                      {gps
                        ? <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '0.8125rem' }}>
                            {Number(gps.lat).toFixed(4)}, {Number(gps.lng).toFixed(4)}
                            <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 5 }}>{gps.at ? new Date(gps.at).toLocaleTimeString() : ''}</span>
                          </span>
                        : <span>No GPS data</span>}
                    </div>
                    <div style={{ marginTop: 3 }}>
                      <Car size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {a.vehicle?.plate_no ?? '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

export default DeliveryMonitoringPage
