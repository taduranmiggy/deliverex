import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BottomSheet from '../../components/driver/BottomSheet'
import DeliveryTimeline from '../../components/driver/DeliveryTimeline'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import DriverStatusChip from '../../components/driver/DriverStatusChip'
import { useDriverUi } from '../../context/DriverUiContext'
import { fetchDriverAssignment, postIssueReport, postStatusUpdate } from '../../api/driver'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import {
  formatJobSchedule,
  formatLastUpdated,
  getNextStatusOptions,
  ISSUE_TYPES,
} from '../../utils/driverAssignment'
import {
  AlertTriangle,
  Car,
  ClipboardList,
  ExternalLink,
  FileUp,
  MapPin,
  Navigation,
  User,
} from 'lucide-react'

const STATUS_META = {
  in_progress: {
    label: 'Start Delivery / En Route',
    confirmTitle: 'Start delivery?',
    confirmSub: 'Mark yourself as en route to the pickup or drop-off location.',
  },
  arrived: {
    label: 'Mark Arrived',
    confirmTitle: 'Confirm arrival?',
    confirmSub: 'Confirm you have arrived at the destination.',
  },
  completed: {
    label: 'Complete Delivery',
    confirmTitle: 'Complete delivery?',
    confirmSub: 'Mark this delivery as completed. This action cannot be undone.',
  },
}

function DriverJobDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useDriverUi()

  const [assignment, setAssignment] = useState(null)
  const [error, setError] = useState('')
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueType, setIssueType] = useState('')
  const [issueNotes, setIssueNotes] = useState('')
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [issueError, setIssueError] = useState('')

  const load = useCallback(() => {
    if (!id) return
    fetchDriverAssignment(id)
      .then((res) => setAssignment(res))
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (location.state?.reportIssue) setIssueOpen(true)
  }, [location.state?.reportIssue])

  const job = assignment?.job_order
  const logs = [...(assignment?.delivery_status_logs ?? [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  )
  const isActive = assignment && !['completed', 'cancelled'].includes(assignment.status)
  const latestGps = [...(assignment?.tracking_logs ?? [])].sort(
    (a, b) => new Date(b.captured_at) - new Date(a.captured_at),
  )[0]
  const dropoff = buildDisplayAddress('dropoff', job) || job?.dropoff_location || ''
  const navUrl = latestGps
    ? `https://www.google.com/maps/dir/?api=1&destination=${latestGps.latitude},${latestGps.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoff)}`
  const wazeUrl = latestGps
    ? `https://waze.com/ul?ll=${latestGps.latitude},${latestGps.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(dropoff)}&navigate=yes`

  const lastUpdated = formatLastUpdated(assignment)
  const nextStatuses = assignment ? getNextStatusOptions(assignment.status) : []
  const deliveryNotes = [job?.notes, job?.job_requirements].filter(Boolean)
  const primaryNext = nextStatuses[0]

  const confirmStatus = async () => {
    if (!assignment || !pendingStatus || statusSubmitting) return
    setStatusSubmitting(true)
    try {
      await postStatusUpdate({ assignment_id: assignment.id, status: pendingStatus })
      showToast('Status updated successfully')
      setPendingStatus(null)
      load()
    } catch {
      showToast('Unable to update status', 'error')
    } finally {
      setStatusSubmitting(false)
    }
  }

  const submitIssue = async () => {
    if (!issueType) {
      setIssueError('Select an issue type.')
      return
    }
    setIssueSubmitting(true)
    setIssueError('')
    try {
      await postIssueReport({
        assignment_id: assignment.id,
        issue_type: issueType,
        notes: issueNotes.trim() || undefined,
      })
      showToast('Issue report submitted')
      setIssueOpen(false)
      setIssueType('')
      setIssueNotes('')
    } catch (err) {
      setIssueError(err.message || 'Unable to submit issue report.')
    } finally {
      setIssueSubmitting(false)
    }
  }

  if (!assignment && !error) {
    return (
      <>
        <DriverOfflineBar />
        <div className="da-skeleton" style={{ minHeight: 200 }} />
      </>
    )
  }

  return (
    <>
      <DriverOfflineBar />
      {error && <p className="da-alert da-alert--error">{error}</p>}

      {assignment && (
        <>
          <div className="da-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--da-muted)' }}>
                {formatJobPublicId(assignment.job_order_id)}
              </span>
              <DriverStatusChip status={assignment.status} />
            </div>
            {lastUpdated && (
              <p style={{ fontSize: '0.75rem', color: 'var(--da-muted)', margin: '0 0 14px' }}>
                Last updated {lastUpdated}
              </p>
            )}
            <DeliveryTimeline status={assignment.status} />
          </div>

          {(buildDisplayName(job) || job?.customer_name) && (
            <div className="da-card">
              <p className="da-card__label">Client</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: '#eff6ff', display: 'grid', placeItems: 'center' }}>
                  <User size={20} color="var(--da-primary)" />
                </div>
                <div>
                  <p style={{ fontWeight: 800, margin: 0, fontSize: '1rem' }}>{buildDisplayName(job) || job.customer_name}</p>
                  {job.customer_contact && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--da-muted)', margin: '2px 0 0' }}>{job.customer_contact}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="da-card">
            <p className="da-card__label"><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />Route</p>
            <div className="da-kv"><span>Pickup</span><strong>{buildDisplayAddress('pickup', job) || '—'}</strong></div>
            <div className="da-kv"><span>Drop-off</span><strong>{buildDisplayAddress('dropoff', job) || '—'}</strong></div>
            <div className="da-kv"><span>Schedule</span><strong>{formatJobSchedule(job)}</strong></div>
            {job?.tracking_code && (
              <div className="da-kv"><span>Tracking</span><strong style={{ fontFamily: 'monospace' }}>{job.tracking_code}</strong></div>
            )}
          </div>

          {isActive && (
            <div className="da-nav-card">
              <p className="da-card__label" style={{ color: 'var(--da-primary)' }}>
                <Navigation size={12} style={{ display: 'inline', marginRight: 4 }} />
                Navigation
              </p>
              <p className="da-nav-card__dest">{dropoff || 'Destination not set'}</p>
              {latestGps && (
                <p style={{ fontSize: '0.75rem', color: 'var(--da-muted)', margin: '0 0 12px' }}>
                  Last known: {Number(latestGps.latitude).toFixed(4)}, {Number(latestGps.longitude).toFixed(4)}
                </p>
              )}
              <div className="da-nav-grid">
                <a href={navUrl} target="_blank" rel="noopener noreferrer" className="da-btn da-btn--maps">
                  <ExternalLink size={16} /> Google Maps
                </a>
                <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="da-btn da-btn--waze">
                  <ExternalLink size={16} /> Waze
                </a>
              </div>
            </div>
          )}

          {assignment.vehicle && (
            <div className="da-card">
              <p className="da-card__label"><Car size={12} style={{ display: 'inline', marginRight: 4 }} />Vehicle</p>
              <div className="da-kv"><span>Plate</span><strong style={{ fontFamily: 'monospace' }}>{assignment.vehicle.plate_no}</strong></div>
              <div className="da-kv"><span>Type</span><strong>{assignment.vehicle.type ?? '—'}</strong></div>
            </div>
          )}

          <div className="da-card">
            <p className="da-card__label"><ClipboardList size={12} style={{ display: 'inline', marginRight: 4 }} />Delivery notes</p>
            {deliveryNotes.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem', lineHeight: 1.5 }}>
                {deliveryNotes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            ) : (
              <p style={{ margin: 0, color: 'var(--da-muted)', fontSize: '0.875rem' }}>No delivery notes.</p>
            )}
          </div>

          {logs.length > 0 && (
            <div className="da-card">
              <p className="da-card__label">Status history</p>
              {logs.map((log, i) => (
                <div key={i} className="da-kv">
                  <span>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</span>
                  <DriverStatusChip status={log.status} />
                </div>
              ))}
            </div>
          )}

          {isActive && (
            <div className="da-job-footer">
              {primaryNext && (
                <button
                  type="button"
                  className="da-btn da-btn--primary da-btn--lg da-btn--block"
                  disabled={statusSubmitting}
                  onClick={() => setPendingStatus(primaryNext.value)}
                >
                  {STATUS_META[primaryNext.value]?.label ?? primaryNext.label}
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="da-btn da-btn--secondary"
                  onClick={() => navigate('/driver/documents', { state: { assignmentId: assignment.id } })}
                >
                  <FileUp size={16} /> Upload Proof
                </button>
                <button type="button" className="da-btn da-btn--outline" onClick={() => setIssueOpen(true)}>
                  <AlertTriangle size={16} /> Report Issue
                </button>
              </div>
            </div>
          )}

          <div style={{ height: isActive ? 120 : 0 }} aria-hidden />

          <BottomSheet
            open={!!pendingStatus}
            onClose={() => !statusSubmitting && setPendingStatus(null)}
            title={STATUS_META[pendingStatus]?.confirmTitle ?? 'Update status?'}
            subtitle={STATUS_META[pendingStatus]?.confirmSub}
            footer={(
              <>
                <button
                  type="button"
                  className="da-btn da-btn--primary da-btn--block"
                  disabled={statusSubmitting}
                  onClick={confirmStatus}
                >
                  {statusSubmitting ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  className="da-btn da-btn--secondary da-btn--block"
                  disabled={statusSubmitting}
                  onClick={() => setPendingStatus(null)}
                >
                  Cancel
                </button>
              </>
            )}
          />

          <BottomSheet
            open={issueOpen}
            onClose={() => !issueSubmitting && setIssueOpen(false)}
            title="Report Issue"
            subtitle="Select the issue type and add details if needed."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ISSUE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`da-issue-option${issueType === t.value ? ' da-issue-option--selected' : ''}`}
                  onClick={() => setIssueType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="da-field" style={{ marginTop: 16 }}>
              <label htmlFor="issue-notes">Additional notes (optional)</label>
              <textarea
                id="issue-notes"
                rows={3}
                placeholder="Describe the issue…"
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
              />
            </div>
            {issueError && <p className="da-alert da-alert--error">{issueError}</p>}
            <div className="da-sheet__actions">
              <button
                type="button"
                className="da-btn da-btn--primary da-btn--block"
                disabled={issueSubmitting}
                onClick={submitIssue}
              >
                {issueSubmitting ? 'Submitting…' : 'Submit Issue Report'}
              </button>
              <button
                type="button"
                className="da-btn da-btn--secondary da-btn--block"
                disabled={issueSubmitting}
                onClick={() => setIssueOpen(false)}
              >
                Cancel
              </button>
            </div>
          </BottomSheet>
        </>
      )}
    </>
  )
}

export default DriverJobDetailsPage
