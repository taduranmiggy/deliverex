import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../../components/driver/BottomSheet'
import DriverJobCard from '../../components/driver/DriverJobCard'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import DriverStatusChip from '../../components/driver/DriverStatusChip'
import { useDriverUi } from '../../context/DriverUiContext'
import { fetchDriverProfile, updateDriverProfile } from '../../api/driver'
import LogoutButton from '../../components/LogoutButton'
import useAuth from '../../hooks/useAuth'
import { Car, ChevronRight, History, Mail, Pencil, Phone, User } from 'lucide-react'

const AVAILABILITY_LABELS = {
  available: 'Available',
  busy: 'On delivery',
  offline: 'Offline',
}

function DriverProfilePage() {
  const { updateUser } = useAuth()
  const { showToast } = useDriverUi()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [historyPage, setHistoryPage] = useState(1)
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDriverProfile(page)
      setProfile(data)
      setName(data.user?.name ?? '')
      setPhone(data.user?.phone ?? '')
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
  const historyMeta = { last_page: history?.last_page ?? 1, total: history?.total ?? 0 }
  const stats = profile?.stats ?? {}
  const current = profile?.current_assignment
  const vehicle = profile?.vehicle
  const availability = profile?.driver?.availability ?? 'available'

  const saveProfile = async () => {
    setSaving(true)
    setEditError('')
    try {
      const res = await updateDriverProfile({ name: name.trim(), phone: phone.trim() || null })
      setProfile((prev) => ({ ...prev, user: { ...prev.user, ...res.user } }))
      updateUser((prev) => ({ ...prev, name: res.user.name, phone: res.user.phone }))
      showToast('Profile updated')
      setEditOpen(false)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !profile) {
    return (
      <>
        <DriverOfflineBar />
        <div className="da-skeleton" style={{ minHeight: 120 }} />
        <div className="da-skeleton" />
      </>
    )
  }

  return (
    <>
      <DriverOfflineBar />
      {error && <p className="da-alert da-alert--error">{error}</p>}

      {profile && (
        <>
          <div className="da-profile-hero">
            <div className="da-profile-hero__avatar">
              <User size={32} />
            </div>
            <div>
              <h2>{profile.user?.name ?? '—'}</h2>
              <DriverStatusChip status={availability} label={AVAILABILITY_LABELS[availability] ?? availability} />
            </div>
          </div>

          <div className="da-card">
            <p className="da-profile-meta"><Mail size={16} /> {profile.user?.email ?? '—'}</p>
            <p className="da-profile-meta"><Phone size={16} /> {profile.user?.phone?.trim() || 'No contact number'}</p>
          </div>

          <div className="da-summary-row">
            <div className="da-summary-pill">
              <strong>{stats.total_deliveries ?? 0}</strong>
              <span>Total</span>
            </div>
            <div className="da-summary-pill">
              <strong>{stats.completed_deliveries ?? 0}</strong>
              <span>Done</span>
            </div>
            <div className="da-summary-pill">
              <strong>{stats.pending_deliveries ?? 0}</strong>
              <span>Pending</span>
            </div>
          </div>

          <button type="button" className="da-btn da-btn--outline da-btn--block" style={{ marginBottom: 12 }} onClick={() => setEditOpen(true)}>
            <Pencil size={16} /> Edit Profile
          </button>

          <p className="da-section-head">Assigned vehicle</p>
          {vehicle ? (
            <div className="da-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Car size={22} color="var(--da-primary)" />
              <div>
                <p style={{ fontWeight: 800, margin: 0 }}>{vehicle.plate_no}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', margin: '2px 0 0' }}>
                  {vehicle.type ?? 'Vehicle'} · {vehicle.status ?? '—'}
                </p>
              </div>
            </div>
          ) : (
            <div className="da-card da-empty" style={{ padding: 24 }}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No vehicle linked to current assignment.</p>
            </div>
          )}

          <p className="da-section-head">Current assignment</p>
          {current ? (
            <Link to={`/driver/jobs/${current.id}`} className="da-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Job #{current.id}</span>
                <DriverStatusChip status={current.status} />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--da-muted)', margin: '8px 0 0' }}>
                {current.job_order?.dropoff_location ?? '—'}
              </p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--da-primary)' }}>
                View details <ChevronRight size={14} />
              </span>
            </Link>
          ) : (
            <div className="da-card da-empty" style={{ padding: 24 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No active assignment</p>
              <Link to="/driver/jobs" className="da-btn da-btn--primary" style={{ marginTop: 12, textDecoration: 'none' }}>
                View Jobs
              </Link>
            </div>
          )}

          <p className="da-section-head">
            <History size={14} style={{ display: 'inline', marginRight: 4 }} />
            Delivery history {historyMeta.total > 0 ? `(${historyMeta.total})` : ''}
          </p>
          {historyItems.length === 0 ? (
            <div className="da-card da-empty" style={{ padding: 24 }}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No completed deliveries yet.</p>
            </div>
          ) : (
            historyItems.map((item) => (
              <DriverJobCard key={item.id} assignment={item} />
            ))
          )}

          {historyMeta.last_page > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="da-btn da-btn--secondary" style={{ flex: 1 }} disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                Previous
              </button>
              <button type="button" className="da-btn da-btn--secondary" style={{ flex: 1 }} disabled={historyPage >= historyMeta.last_page} onClick={() => setHistoryPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <LogoutButton />
          </div>

          <BottomSheet
            open={editOpen}
            onClose={() => !saving && setEditOpen(false)}
            title="Edit Profile"
            subtitle="Update your name and contact number."
          >
            <div className="da-field">
              <label htmlFor="edit-name">Full name</label>
              <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="da-field">
              <label htmlFor="edit-phone">Contact number</label>
              <input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 …" />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', margin: '0 0 12px' }}>
              Email changes require dispatcher approval.
            </p>
            {editError && <p className="da-alert da-alert--error">{editError}</p>}
            <div className="da-sheet__actions">
              <button type="button" className="da-btn da-btn--primary da-btn--block" disabled={saving} onClick={saveProfile}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="da-btn da-btn--secondary da-btn--block" disabled={saving} onClick={() => setEditOpen(false)}>
                Cancel
              </button>
            </div>
          </BottomSheet>
        </>
      )}
    </>
  )
}

export default DriverProfilePage
