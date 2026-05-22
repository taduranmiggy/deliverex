import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchDriverAssignments, postStatusUpdate } from '../../api/driver'
import { enqueue } from '../../utils/offlineQueue'
import { STATUS_OPTIONS, formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'
import useSyncOnReconnect from '../../hooks/useSyncOnReconnect'

function DeliveryStatusUpdatePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { syncState, pendingCount, isOnline } = useSyncOnReconnect()

  const [assignments, setAssignments] = useState([])
  const [selectedId, setSelectedId] = useState(location.state?.assignmentId ?? '')
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [gpsAttach, setGpsAttach] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchDriverAssignments(1)
        const active = (res.data || []).filter(
          (a) => !['completed', 'cancelled'].includes(a.status),
        )
        setAssignments(active)
        if (!selectedId && active.length > 0) {
          setSelectedId(active[0].id)
        }
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, []) // eslint-disable-line

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedId || !status) {
      setError('Select an assignment and a status.')
      return
    }

    if (['completed', 'cancelled'].includes(status)) {
      const label = status === 'completed' ? 'Completed' : 'Cancelled'
      const confirmed = window.confirm(
        `Mark this delivery as ${label}? This action cannot be undone.`
      )
      if (!confirmed) return
    }

    setMessage('')
    setError('')
    setSubmitting(true)

    const payload = { assignment_id: Number(selectedId), status, notes: notes || undefined }

    if (gpsAttach && navigator.geolocation) {
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 }),
        )
        payload.latitude  = pos.coords.latitude
        payload.longitude = pos.coords.longitude
      } catch {
        // GPS unavailable — continue without coords
      }
    }

    if (!isOnline) {
      enqueue({ type: 'status', payload })
      setMessage('Status update queued — will sync when you go online.')
      setSubmitting(false)
      return
    }

    try {
      await postStatusUpdate(payload)
      setMessage('Status updated successfully.')
      setNotes('')
      setStatus('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedAssignment = assignments.find((a) => String(a.id) === String(selectedId))

  return (
    <section className="driver-page">
      <button type="button" className="driver-back-btn" onClick={() => navigate('/driver')}>
        ← Back
      </button>
      <header className="driver-page-header">
        <h1>Status Update</h1>
        <p className="driver-page-sub">
          {isOnline
            ? pendingCount > 0 ? `${pendingCount} queued — syncing…` : 'Online'
            : `Offline · ${pendingCount} queued`}
        </p>
      </header>

      <form className="driver-form-card" onSubmit={handleSubmit}>
        {/* Assignment selector */}
        <div className="driver-field">
          <label htmlFor="dx-assign-sel">Assignment</label>
          <select
            id="dx-assign-sel"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            required
          >
            <option value="">— Select assignment —</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} · {a.job_order?.pickup_location ?? '?'} → {a.job_order?.dropoff_location ?? '?'}
              </option>
            ))}
          </select>
        </div>

        {selectedAssignment && (
          <div className="driver-current-status">
            Current:{' '}
            <span className={jobStatusBadgeClass(selectedAssignment.status)}>
              {formatJobStatus(selectedAssignment.status)}
            </span>
          </div>
        )}

        {/* New status */}
        <div className="driver-field">
          <label htmlFor="dx-status-sel">New status</label>
          <select
            id="dx-status-sel"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            required
          >
            <option value="">— Select status —</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="driver-field">
          <label htmlFor="dx-notes">Notes (optional)</label>
          <textarea
            id="dx-notes"
            rows={3}
            placeholder="Any delivery remarks…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* GPS attach toggle */}
        <label className="driver-checkbox-row">
          <input
            type="checkbox"
            checked={gpsAttach}
            onChange={(e) => setGpsAttach(e.target.checked)}
          />
          Attach current GPS location
        </label>

        {message && <p className="driver-success">{message}</p>}
        {error   && <p className="driver-error">{error}</p>}

        <button
          type="submit"
          className="driver-btn-primary driver-btn-full"
          disabled={submitting || syncState === 'syncing'}
        >
          {submitting ? 'Submitting…' : 'Submit Update'}
        </button>
      </form>
    </section>
  )
}

export default DeliveryStatusUpdatePage
