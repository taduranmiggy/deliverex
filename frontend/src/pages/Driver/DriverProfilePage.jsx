import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDriverProfile } from '../../api/driver'
import LogoutButton from '../../components/LogoutButton'
import { StatusBadge } from '../../components/ui'
import useAuth from '../../hooks/useAuth'
import {
  Car,
  ChevronRight,
  ClipboardList,
  History,
  Mail,
  Phone,
  User,
} from 'lucide-react'

const AVAILABILITY_LABELS = {
  available: 'Available',
  busy: 'On delivery',
  offline: 'Offline',
}

function DriverProfilePage() {
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [historyPage, setHistoryPage] = useState(1)

  const load = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDriverProfile(page)
      setProfile(data)
      if (data?.user) {
        updateUser((prev) => ({
          ...prev,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          driver: data.driver
            ? { ...data.driver, current_assignment: data.current_assignment }
            : prev?.driver,
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [updateUser])

  useEffect(() => {
    load(historyPage)
  }, [historyPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const history = profile?.delivery_history
  const historyItems = history?.data ?? []
  const historyMeta = {
    last_page: history?.last_page ?? 1,
    total: history?.total ?? 0,
  }

  const current = profile?.current_assignment
  const vehicle = profile?.vehicle
  const availability = profile?.driver?.availability ?? 'available'

  return (
    <section className="driver-page">
      <header className="driver-page-header">
        <div>
          <h1>My Profile</h1>
          <p className="driver-page-sub">Your account and delivery activity</p>
        </div>
        <LogoutButton />
      </header>

      {error && <p className="driver-banner-error" style={{ marginBottom: 16 }}>{error}</p>}
      {loading && !profile && <p className="driver-page-sub">Loading profile…</p>}

      {profile && (
        <>
          <div className="driver-profile-card">
            <div className="driver-profile-card__avatar" aria-hidden>
              <User size={28} />
            </div>
            <div className="driver-profile-card__body">
              <h2 className="driver-profile-card__name">{profile.user?.name ?? '—'}</h2>
              <p className="driver-profile-meta">
                <Mail size={14} aria-hidden />
                {profile.user?.email ?? '—'}
              </p>
              <p className="driver-profile-meta">
                <Phone size={14} aria-hidden />
                {profile.user?.phone?.trim() ? profile.user.phone : 'No contact number on file'}
              </p>
              <p className="driver-profile-meta">
                License: <strong>{profile.driver?.license_no ?? '—'}</strong>
              </p>
              <span className={`driver-avail-pill driver-avail-pill--${availability}`}>
                {AVAILABILITY_LABELS[availability] ?? availability}
              </span>
            </div>
          </div>

          <div className="driver-section">
            <h3 className="driver-section-title">Assigned vehicle</h3>
            {vehicle ? (
              <div className="driver-info-tile">
                <Car size={20} style={{ flexShrink: 0, opacity: 0.6 }} />
                <div>
                  <p style={{ fontWeight: 700, margin: 0 }}>{vehicle.plate_no}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {vehicle.type ?? 'Vehicle'} · {vehicle.status ?? '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="driver-empty-card" style={{ marginBottom: 0, padding: 20 }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No vehicle linked to your current assignment.</p>
              </div>
            )}
          </div>

          <div className="driver-section">
            <h3 className="driver-section-title">Current assignment</h3>
            {current ? (
              <Link to={`/driver/jobs/${current.id}`} className="driver-job-row">
                <div className="driver-job-row__top">
                  <span className="driver-job-row__id">#{current.id}</span>
                  <StatusBadge status={current.status} />
                </div>
                <p className="driver-job-row__route">
                  {current.job_order?.pickup_location ?? '—'} → {current.job_order?.dropoff_location ?? '—'}
                </p>
                {current.job_order?.tracking_code && (
                  <p className="driver-job-row__vehicle">Tracking: {current.job_order.tracking_code}</p>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                  View details <ChevronRight size={14} />
                </span>
              </Link>
            ) : (
              <div className="driver-empty-card" style={{ marginBottom: 0, padding: 20 }}>
                <ClipboardList size={24} style={{ margin: '0 auto 8px', opacity: 0.25 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No active assignment</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>Check My Jobs when dispatch assigns you.</p>
                <Link to="/driver" className="driver-btn-primary" style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none' }}>
                  Go to My Jobs
                </Link>
              </div>
            )}
          </div>

          <div className="driver-section">
            <h3 className="driver-section-title">
              <History size={14} style={{ display: 'inline', marginRight: 4 }} />
              Delivery history
              {historyMeta.total > 0 ? ` (${historyMeta.total})` : ''}
            </h3>
            {historyItems.length === 0 ? (
              <div className="driver-empty-card" style={{ marginBottom: 0, padding: 20 }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No completed deliveries yet.</p>
              </div>
            ) : (
              historyItems.map((item) => (
                <Link key={item.id} to={`/driver/jobs/${item.id}`} className="driver-job-row">
                  <div className="driver-job-row__top">
                    <span className="driver-job-row__id">#{item.id}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="driver-job-row__route">
                    {item.job_order?.customer_name ?? 'Delivery'} — {item.job_order?.dropoff_location ?? '—'}
                  </p>
                  <p className="driver-job-row__vehicle">
                    {item.vehicle?.plate_no ? `${item.vehicle.plate_no} · ` : ''}
                    {item.completed_at
                      ? `Completed ${new Date(item.completed_at).toLocaleDateString()}`
                      : item.assigned_at
                        ? `Assigned ${new Date(item.assigned_at).toLocaleDateString()}`
                        : '—'}
                    {item.delivery_status_logs_count != null
                      ? ` · ${item.delivery_status_logs_count} status update(s)`
                      : ''}
                  </p>
                </Link>
              ))
            )}
            {historyMeta.last_page > 1 && (
              <div className="dx-pagination" style={{ marginTop: 12 }}>
                <button type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                  Previous
                </button>
                <span>
                  Page {historyPage} / {historyMeta.last_page}
                </span>
                <button
                  type="button"
                  disabled={historyPage >= historyMeta.last_page}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="driver-profile-logout-block">
            <LogoutButton />
          </div>
        </>
      )}
    </section>
  )
}

export default DriverProfilePage
