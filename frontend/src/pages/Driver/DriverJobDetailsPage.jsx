import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchDriverAssignment } from '../../api/driver'
import { StatusBadge } from '../../components/ui'
import { formatJobPublicId } from '../../utils/formatPhp'
import { ArrowLeft, Calendar, Car, ClipboardList, ExternalLink, FileUp, MapPin, Navigation, User } from 'lucide-react'

function DriverJobDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState(null)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!id) return
    fetchDriverAssignment(id)
      .then((res) => setAssignment(res))
      .catch((err) => setError(err.message))
  }, [id])

  const job = assignment?.job_order
  const logs = [...(assignment?.delivery_status_logs ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const isActive = assignment && !['completed', 'cancelled'].includes(assignment.status)
  const latestGps = [...(assignment?.tracking_logs ?? [])].sort(
    (a, b) => new Date(b.captured_at) - new Date(a.captured_at),
  )[0]
  const dropoff = job?.dropoff_location ?? ''
  const navUrl = latestGps
    ? `https://www.google.com/maps/dir/?api=1&destination=${latestGps.latitude},${latestGps.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoff)}`
  const wazeUrl = latestGps
    ? `https://waze.com/ul?ll=${latestGps.latitude},${latestGps.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(dropoff)}&navigate=yes`

  return (
    <section className="driver-page">
      <button type="button" className="driver-back-btn" onClick={() => navigate('/driver')}>
        <ArrowLeft size={16} /> Back to jobs
      </button>

      <div className="driver-page-header">
        <div>
          <h1>Job Details</h1>
          {assignment?.job_order_id && (
            <p className="driver-page-sub" style={{ fontFamily: 'monospace' }}>{formatJobPublicId(assignment.job_order_id)}</p>
          )}
        </div>
        {assignment && <StatusBadge status={assignment.status} />}
      </div>

      {error && <p className="driver-error">{error}</p>}
      {!assignment && !error && (
        <div className="driver-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
          Loading…
        </div>
      )}

      {assignment && (
        <>
          {/* Client */}
          {job?.customer_name && (
            <div className="driver-card" style={{ background: 'linear-gradient(135deg, var(--color-primary), #1d4ed8)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center' }}>
                  <User size={20} color="#fff" />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>Client</p>
                  <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0, color: '#fff' }}>{job.customer_name}</p>
                  {job.customer_contact && <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', margin: 0 }}>{job.customer_contact}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Route card */}
          <div className="driver-card">
            <p className="driver-card-title"><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} /> Route</p>
            <div className="driver-kv"><span>Pickup</span><strong>{job?.pickup_location ?? '—'}</strong></div>
            <div className="driver-kv"><span>Drop-off</span><strong>{job?.dropoff_location ?? '—'}</strong></div>
            {job?.scheduled_start && (
              <div className="driver-kv">
                <span><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Schedule</span>
                <strong style={{ fontSize: '0.875rem' }}>
                  {new Date(job.scheduled_start).toLocaleString()}
                  {job.scheduled_end ? ` → ${new Date(job.scheduled_end).toLocaleString()}` : ''}
                </strong>
              </div>
            )}
            <div className="driver-kv">
              <span>Priority</span>
              <strong style={{ textTransform: 'capitalize' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.8125rem', background: job?.priority === 'urgent' ? 'var(--color-error-light)' : job?.priority === 'high' ? 'var(--color-warning-light)' : 'var(--slate-100)', color: job?.priority === 'urgent' ? 'var(--color-error)' : job?.priority === 'high' ? 'var(--color-warning)' : 'var(--muted)' }}>
                  {job?.priority ?? '—'}
                </span>
              </strong>
            </div>
          </div>

          {/* Vehicle */}
          {assignment.vehicle && (
            <div className="driver-card">
              <p className="driver-card-title"><Car size={12} style={{ display: 'inline', marginRight: 4 }} /> Vehicle</p>
              <div className="driver-kv"><span>Plate</span><strong style={{ fontFamily: 'monospace' }}>{assignment.vehicle.plate_no}</strong></div>
              <div className="driver-kv"><span>Type</span><strong>{assignment.vehicle.type}</strong></div>
              {assignment.vehicle.capacity && <div className="driver-kv"><span>Capacity</span><strong>{assignment.vehicle.capacity}</strong></div>}
            </div>
          )}

          {/* Special instructions */}
          {job?.job_requirements && (
            <div className="driver-card">
              <p className="driver-card-title"><ClipboardList size={12} style={{ display: 'inline', marginRight: 4 }} /> Special Instructions</p>
              <p className="driver-requirements">{job.job_requirements}</p>
            </div>
          )}

          {/* Timeline */}
          {logs.length > 0 && (
            <div className="driver-card">
              <p className="driver-card-title">Delivery Timeline</p>
              <ol className="driver-timeline">
                {logs.map((log, i) => (
                  <li key={i} className="driver-timeline-item">
                    <div className="driver-timeline-dot" style={{ background: log.status === 'completed' ? 'var(--color-success)' : 'var(--color-primary)' }} />
                    <div>
                      <StatusBadge status={log.status} />
                      {log.notes && <span className="driver-timeline-note">{log.notes}</span>}
                      <div className="driver-timeline-time">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {isActive && (
            <div className="driver-card">
              <p className="driver-card-title"><Navigation size={12} style={{ display: 'inline', marginRight: 4 }} /> Navigation</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={navUrl} target="_blank" rel="noopener noreferrer" className="driver-btn-secondary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>
                  <ExternalLink size={14} /> Google Maps
                </a>
                <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="driver-btn-secondary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>
                  <ExternalLink size={14} /> Waze
                </a>
              </div>
            </div>
          )}

          {/* Actions */}
          {isActive && (
            <div className="driver-sticky-actions">
              <button type="button" className="driver-btn-primary"
                style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)', flex: 1 }}
                onClick={() => navigate('/driver/status-update', { state: { assignmentId: assignment.id } })}>
                Update Status
              </button>
              <button type="button" className="driver-btn-secondary"
                style={{ background: 'var(--surface)', color: 'var(--slate-700)', border: '1.5px solid var(--stroke)', flex: 1, justifyContent: 'center' }}
                onClick={() => navigate('/driver/documents', { state: { assignmentId: assignment.id } })}>
                <FileUp size={16} /> Upload Docs
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default DriverJobDetailsPage
