import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDriverAssignments, postTrackingUpdate } from '../../api/driver'
import { enqueue } from '../../utils/offlineQueue'
import { StatusBadge } from '../../components/ui'
import useSyncOnReconnect from '../../hooks/useSyncOnReconnect'
import { CheckCircle2, ChevronRight, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react'

function DriverDashboard() {
  const [assignments, setAssignments] = useState([])
  const [error, setError]             = useState('')
  const [gpsMsg, setGpsMsg]           = useState('')
  const { syncState, lastSynced, pendingCount, isOnline, manualSync } = useSyncOnReconnect()

  useEffect(() => {
    fetchDriverAssignments(1)
      .then((res) => setAssignments(res.data || []))
      .catch((err) => setError(err.message))
  }, [])

  const active = assignments.find((a) => !['completed', 'cancelled'].includes(a.status))

  const handleGpsPing = () => {
    if (!active) { setGpsMsg('No active assignment.'); return }
    if (!navigator.geolocation) { setGpsMsg('Geolocation not supported.'); return }
    setGpsMsg('Locating…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const payload = { assignment_id: active.id, latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        if (!isOnline) {
          enqueue({ type: 'tracking', payload })
          setGpsMsg('GPS queued for sync.')
        } else {
          postTrackingUpdate(payload)
            .then(() => setGpsMsg('GPS sent ✓'))
            .catch((e) => setGpsMsg(`GPS error: ${e.message}`))
        }
      },
      (err) => setGpsMsg(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const syncIcon = syncState === 'syncing' ? <RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> :
    isOnline ? <Wifi size={14} /> : <WifiOff size={14} />

  return (
    <section className="driver-page">
      {/* Connectivity bar */}
      <div className={`driver-conn-bar ${isOnline ? 'driver-conn-bar--online' : 'driver-conn-bar--offline'}`}>
        <span className={`driver-conn-dot ${isOnline ? 'online' : 'offline'}`} />
        {syncIcon}
        <span>{isOnline ? (syncState === 'syncing' ? 'Syncing…' : syncState === 'synced' ? 'Synced ✓' : 'Online') : 'Offline'}</span>
        {pendingCount > 0 && <span className="driver-conn-queued">{pendingCount} queued</span>}
        <div style={{ flex: 1 }} />
        {pendingCount > 0 && isOnline && (
          <button type="button" className="driver-conn-sync-btn" onClick={manualSync} disabled={syncState === 'syncing'}>
            {syncState === 'syncing' ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </div>

      <div className="driver-page-header">
        <div>
          <h1>My Jobs</h1>
          {lastSynced && <p className="driver-page-sub">Synced {lastSynced.toLocaleTimeString()}</p>}
        </div>
      </div>

      {error && <p className="driver-error">{error}</p>}

      {/* Active job card */}
      {active ? (
        <div className="driver-active-card">
          <div className="driver-active-card__header">
            <span className="driver-active-card__label">Active Delivery</span>
            <StatusBadge status={active.status} />
          </div>
          <p className="driver-active-card__route">
            <MapPin size={16} style={{ display: 'inline', marginRight: 4 }} />
            {active.job_order?.pickup_location ?? '—'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '4px 0 18px', fontSize: '0.875rem' }}>
            → {active.job_order?.dropoff_location ?? '—'}
          </p>
          <div className="driver-active-card__actions">
            <Link to={`/driver/jobs/${active.id}`} className="driver-btn-primary">
              <CheckCircle2 size={16} /> View details
            </Link>
            <button type="button" className="driver-btn-ghost" onClick={handleGpsPing}>
              <MapPin size={15} /> GPS
            </button>
          </div>
          {gpsMsg && <p className="driver-gps-msg">{gpsMsg}</p>}
        </div>
      ) : (
        <div className="driver-empty-card">
          <CheckCircle2 size={28} style={{ margin: '0 auto 8px', opacity: 0.25 }} />
          <p style={{ fontWeight: 600 }}>No active assignment</p>
          <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>You have no deliveries in progress.</p>
        </div>
      )}

      {/* All jobs */}
      {assignments.length > 0 && (
        <div className="driver-section">
          <p className="driver-section-title">All Jobs ({assignments.length})</p>
          {assignments.map((a) => (
            <Link key={a.id} to={`/driver/jobs/${a.id}`} className="driver-job-row">
              <div className="driver-job-row__top">
                <span className="driver-job-row__id">Assignment #{a.id}</span>
                <StatusBadge status={a.status} />
              </div>
              <p className="driver-job-row__route">
                {a.job_order?.pickup_location ?? '—'} → {a.job_order?.dropoff_location ?? '—'}
              </p>
              {a.vehicle?.plate_no && <p className="driver-job-row__vehicle">{a.vehicle.plate_no} · {a.vehicle.type}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default DriverDashboard
