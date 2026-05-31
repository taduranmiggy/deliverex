import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DriverJobCard from '../../components/driver/DriverJobCard'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import DriverStatusChip from '../../components/driver/DriverStatusChip'
import useAuth from '../../hooks/useAuth'
import { fetchDriverAssignments, fetchDriverProfile } from '../../api/driver'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobSchedule } from '../../utils/driverAssignment'
import { computeJobStats, getActiveAssignment } from '../../utils/driverStats'
import { ChevronRight, MapPin, Truck } from 'lucide-react'

function DriverHomePage() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchDriverAssignments(1), fetchDriverProfile()])
      .then(([assignRes, profile]) => {
        setAssignments(assignRes.data || [])
        setVehicle(profile?.vehicle ?? profile?.current_assignment?.vehicle ?? null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const active = getActiveAssignment(assignments)
  const stats = computeJobStats(assignments)
  const driverName = user?.name?.split(' ')[0] ?? 'Driver'

  const todayJobs = assignments.filter((a) => {
    const sched = a.job_order?.scheduled_start
    if (!sched) return !['completed', 'cancelled'].includes(a.status)
    const d = new Date(sched)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })

  const upcoming = assignments
    .filter((a) => !['completed', 'cancelled'].includes(a.status) && a.id !== active?.id)
    .slice(0, 5)

  if (loading) {
    return (
      <>
        <DriverOfflineBar />
        <div className="da-skeleton" style={{ minHeight: 120 }} />
        <div className="da-skeleton" />
        <div className="da-skeleton" />
      </>
    )
  }

  return (
    <>
      <DriverOfflineBar />

      <div className="da-greeting">
        <h2>Hello, {driverName}</h2>
        <p>
          {stats.pending > 0
            ? `You have ${stats.pending} active deliver${stats.pending === 1 ? 'y' : 'ies'} today.`
            : 'No active deliveries right now.'}
        </p>
      </div>

      {error && <p className="da-alert da-alert--error">{error}</p>}

      <div className="da-summary-row">
        <div className="da-summary-pill">
          <strong>{stats.jobsToday}</strong>
          <span>Today</span>
        </div>
        <div className="da-summary-pill">
          <strong>{stats.pending}</strong>
          <span>Pending</span>
        </div>
        <div className="da-summary-pill">
          <strong>{stats.completed}</strong>
          <span>Done</span>
        </div>
      </div>

      <p className="da-section-head">Current delivery</p>
      {active ? (
        <div className="da-card da-card--hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
            <span className="da-card__label" style={{ opacity: 1 }}>Active now</span>
            <DriverStatusChip status={active.status} />
          </div>
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.8, margin: '0 0 4px' }}>
            {formatJobPublicId(active.job_order_id)}
          </p>
          <p style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 8px' }}>
            {active.job_order?.customer_name ?? 'Delivery'}
          </p>
          <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.875rem', margin: '0 0 6px', opacity: 0.95 }}>
            <MapPin size={16} style={{ flexShrink: 0 }} />
            {active.job_order?.dropoff_location ?? '—'}
          </p>
          <p style={{ fontSize: '0.8125rem', opacity: 0.8, margin: '0 0 16px' }}>
            {formatJobSchedule(active.job_order)}
          </p>
          <Link to={`/driver/jobs/${active.id}`} className="da-btn da-btn--ghost da-btn--block">
            Continue delivery <ChevronRight size={18} />
          </Link>
        </div>
      ) : (
        <div className="da-card da-empty">
          <Truck size={36} />
          <p style={{ fontWeight: 700, margin: '8px 0 4px', color: 'var(--da-text)' }}>No active delivery</p>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>New assignments will appear here.</p>
        </div>
      )}

      {vehicle && (
        <div className="da-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Truck size={22} color="var(--da-primary)" />
          <div>
            <p className="da-card__label" style={{ margin: 0 }}>Assigned vehicle</p>
            <p style={{ fontWeight: 800, margin: '2px 0 0', fontSize: '1rem' }}>{vehicle.plate_no}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', margin: 0 }}>{vehicle.type ?? 'Vehicle'}</p>
          </div>
        </div>
      )}

      {todayJobs.length > 0 && (
        <>
          <p className="da-section-head">Today&apos;s assigned deliveries</p>
          {todayJobs.map((a) => (
            <DriverJobCard key={a.id} assignment={a} />
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <p className="da-section-head">Upcoming</p>
          {upcoming.map((a) => (
            <DriverJobCard key={a.id} assignment={a} />
          ))}
        </>
      )}

      {todayJobs.length === 0 && upcoming.length === 0 && !active && (
        <Link to="/driver/jobs" className="da-btn da-btn--primary da-btn--block">
          View all jobs
        </Link>
      )}
    </>
  )
}

export default DriverHomePage
