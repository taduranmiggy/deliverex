import { useEffect, useState } from 'react'
import { createAssignment, fetchJobOrders, getBestFit } from '../../api/dispatcher'
import { IconCheckSmall, IconRouteArrow } from '../../components/DxIcons'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus } from '../../utils/statusLabels'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, User, Truck } from 'lucide-react'

/* ── Confirmation modal ─────────────────────────────────────── */
function AssignConfirmModal({ job, candidate, isOverride, onConfirm, onCancel, submitting, error }) {
  return (
    <div className="dx-modal-backdrop" onClick={onCancel}>
      <div className="dx-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-labelledby="assign-modal-title">
        <div className="dx-modal-header">
          <h2 id="assign-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOverride
              ? <><AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} /> Override Assignment</>
              : <><CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} /> Confirm Assignment</>
            }
          </h2>
          <button type="button" className="dx-modal-close" onClick={onCancel} disabled={submitting}>×</button>
        </div>

        <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isOverride && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-light, #fffbeb)', border: '1px solid var(--color-warning-mid, #fde68a)', fontSize: '0.875rem', color: 'var(--color-warning, #b45309)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              This selection differs from the Best-Fit recommendation. The recommended pairing optimizes capacity and availability.
            </div>
          )}

          {/* Job order summary */}
          <div style={{ background: 'var(--slate-50, #f8fafc)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--stroke)' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>Job Order</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{formatJobPublicId(job.id)}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{job.priority} priority</span>
            </div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{job.client?.client_name || buildDisplayName(job)}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: 0 }}>
              {buildDisplayAddress('pickup', job)} → {buildDisplayAddress('dropoff', job)}
            </p>
            {(job.volume_m3 || job.material_type || job.specification_size) && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: 4 }}>
                Load: {[job.load_volume_m3 || job.volume_m3 ? `${job.load_volume_m3 ?? job.volume_m3} m³` : null, job.material_type || null, job.specification_size || null].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Driver + Vehicle row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--color-primary-light, #eff6ff)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--color-primary-border, #bfdbfe)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={12} /> Driver
              </p>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{candidate.driver_name}</p>
            </div>
            <div style={{ background: 'var(--color-primary-light, #eff6ff)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--color-primary-border, #bfdbfe)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Truck size={12} /> Vehicle
              </p>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{candidate.vehicle_plate}</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: 0 }}>
                {[candidate.vehicle_type, candidate.vehicle_cbm_capacity ? `${candidate.vehicle_cbm_capacity} m³` : candidate.vehicle_capacity].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>

          {/* Score + reasons */}
          {(candidate.score != null || (Array.isArray(candidate.reasons) && candidate.reasons.length > 0)) && (
            <div style={{ borderRadius: 10, border: '1px solid var(--stroke)', padding: '12px 14px' }}>
              {candidate.score != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: Array.isArray(candidate.reasons) && candidate.reasons.length > 0 ? 10 : 0 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Best-Fit score</span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary)' }}>{candidate.score}</span>
                </div>
              )}
              {Array.isArray(candidate.reasons) && candidate.reasons.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  {candidate.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p style={{ margin: 0, padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-light, #fef2f2)', border: '1px solid var(--color-error-mid, #fca5a5)', color: 'var(--color-error)', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn-dx-primary"
              style={{ flex: 1, justifyContent: 'center', background: isOverride ? 'var(--color-warning, #d97706)' : undefined, borderColor: isOverride ? 'var(--color-warning, #d97706)' : undefined }}
              onClick={onConfirm}
              disabled={submitting}
            >
              {submitting
                ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Assigning…</>
                : isOverride ? 'Confirm Override' : 'Confirm Assignment'
              }
            </button>
            <button type="button" className="btn-dx-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────── */
function AssignDriverVehiclePage() {
  const [jobOrders, setJobOrders]             = useState([])
  const [selected, setSelected]               = useState(null)
  const [recommended, setRecommended]         = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading]                 = useState(false)
  const [message, setMessage]                 = useState('')
  const [error, setError]                     = useState('')

  // Modal state
  const [pendingAssign, setPendingAssign]     = useState(null)   // { candidate, isOverride }
  const [submitting, setSubmitting]           = useState(false)
  const [modalError, setModalError]           = useState('')

  const loadJobs = async () => {
    try {
      const res = await fetchJobOrders(1)
      const pending = (res.data || []).filter((item) => item.status === 'pending')
      setJobOrders(pending)
      setSelected((prev) => {
        if (prev && pending.some((p) => p.id === prev.id)) return prev
        return pending[0] ?? null
      })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadJobs() }, []) // eslint-disable-line

  useEffect(() => {
    if (!selected) { return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getBestFit(selected.id)
      .then((res) => {
        setRecommended(res.recommended || null)
        setRecommendations(res.recommendations || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selected])

  // Open modal instead of immediately assigning
  const openModal = (candidate, isOverride = false) => {
    if (!selected) { setError('Select a job order first.'); return }
    setModalError('')
    setPendingAssign({ candidate, isOverride })
  }

  // Called when dispatcher clicks "Confirm" inside the modal
  const handleConfirm = async () => {
    if (!pendingAssign || !selected) return
    setSubmitting(true)
    setModalError('')
    try {
      await createAssignment({
        job_order_id: selected.id,
        driver_id:    pendingAssign.candidate.driver_id,
        vehicle_id:   pendingAssign.candidate.vehicle_id,
      })
      setPendingAssign(null)
      setMessage(`Assignment confirmed — ${pendingAssign.candidate.driver_name} dispatched. Driver has been notified.`)
      setTimeout(() => setMessage(''), 6000)
      await loadJobs()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const top = recommended || recommendations[0]

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Dispatch (Best-Fit)</h1>
          <p>System-generated job assignment recommendations</p>
        </div>
      </header>
      {message && <p className="notice">{message}</p>}
      {error   && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit">
        <div>
          <div className="dx-panel" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--navy)' }}>{jobOrders.length}</strong> jobs pending assignment
            </p>
          </div>
          {jobOrders.length === 0 && (
            <div className="dx-panel"><p style={{ margin: 0, color: 'var(--muted)' }}>No unassigned jobs.</p></div>
          )}
          {jobOrders.map((order) => (
            <button key={order.id} type="button"
              className={`dx-job-card ${selected?.id === order.id ? 'dx-job-card--selected' : ''}`}
              onClick={() => setSelected(order)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="dx-job-card__id">{formatJobPublicId(order.id)}</span>
                <span className="badge-dx badge-dx--pending">{formatJobStatus(order.status)}</span>
              </div>
              <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>{order.client?.client_name || buildDisplayName(order)}</p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8125rem' }}>
                {[order.material_type || null, order.specification_size ?? null].filter(Boolean).join(' · ') || 'Material not set'}
              </p>
              <p className="dx-route-inline" style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                <span>{buildDisplayAddress('pickup', order)}</span>
                <span className="dx-route-inline__arrow" aria-hidden><IconRouteArrow /></span>
                <span>{buildDisplayAddress('dropoff', order)}</span>
              </p>
              {order.scheduled_start && (
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {new Date(order.scheduled_start).toLocaleString()}
                  {order.scheduled_end ? ` — ${new Date(order.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="dx-panel">
          <h3 className="dx-panel-title">Recommendation Panel</h3>
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>Select a job to view recommendations.</p>
          ) : loading ? (
            <p style={{ color: 'var(--muted)' }}>Analyzing available resources…</p>
          ) : (
            <>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Material profile</span>
                <strong>{[selected.material_type || null, selected.specification_size ?? null].filter(Boolean).join(' · ') || '—'}</strong>
              </div>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Load volume</span>
                <strong>
                  {selected.load_volume_m3 || selected.volume_m3 ? `${selected.load_volume_m3 ?? selected.volume_m3} m³` : '—'}
                </strong>
              </div>
              {selected.scheduled_end && (
                <div className="dx-kv" style={{ marginBottom: 14 }}>
                  <span>Deadline</span>
                  <strong>{new Date(selected.scheduled_end).toLocaleString()}</strong>
                </div>
              )}

              {top ? (
                <>
                  <div className="dx-bestfit-banner" role="status">
                    <span className="dx-bestfit-banner__icon" aria-hidden><IconCheckSmall /></span>
                    Recommended assignment
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 8 }}>
                    <span>Driver</span>
                    <strong>{top.driver_name}</strong>
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 12 }}>
                    <span>Vehicle</span>
                    <strong>
                      {top.vehicle_plate}
                      {top.vehicle_type ? ` — ${top.vehicle_type}` : ''}
                      {top.vehicle_cbm_capacity ? ` (${top.vehicle_cbm_capacity} m³)` : (top.vehicle_capacity ? ` (${top.vehicle_capacity})` : '')}
                    </strong>
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 12 }}>
                    <span>Unused capacity</span>
                    <strong>
                      {top.unused_capacity != null ? `${top.unused_capacity} m³` : '—'}
                      {top.client_preference_match ? ' · preference matched' : ''}
                    </strong>
                  </div>

                  {Array.isArray(top.reasons) && top.reasons.length > 0 && (
                    <div className="dx-why-box">
                      <strong>Why this assignment?</strong>
                      <ul>
                        {top.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="dx-why-box">
                  <strong>No recommendations available</strong>
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    No available drivers or vehicles match the requirements for this job.
                  </p>
                  <a
                    href="/admin/master-data"
                    title="Fleet master data is managed by Admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} /> Check fleet availability in Master Data
                  </a>
                </div>
              )}

              {recommendations.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <strong style={{ fontSize: '0.875rem' }}>All matches</strong>
                  <div className="dx-data-table-wrap" style={{ marginTop: 8 }}>
                    <table className="dx-data-table">
                      <thead><tr><th>Driver</th><th>Plate</th><th>Vehicle Type</th><th>Capacity</th><th>Load</th><th>Unused</th><th>Pref.</th><th>Score</th><th>Reason</th><th /></tr></thead>
                      <tbody>
                        {recommendations.map((item) => {
                          const isTop = top && item.driver_id === top.driver_id && item.vehicle_id === top.vehicle_id
                          return (
                            <tr key={`${item.driver_id}-${item.vehicle_id}`}>
                              <td>{item.driver_name}</td>
                              <td>{item.vehicle_plate}</td>
                              <td>{item.vehicle_type || '—'}</td>
                              <td>{item.vehicle_cbm_capacity != null ? `${item.vehicle_cbm_capacity} m³` : (item.vehicle_capacity || '—')}</td>
                              <td>{item.load_volume != null ? `${item.load_volume} m³` : '—'}</td>
                              <td>{item.unused_capacity != null ? `${item.unused_capacity} m³` : '—'}</td>
                              <td>{item.client_preference_match ? 'Match' : '—'}</td>
                              <td><span className="badge-dx badge-dx--muted">{item.score}</span></td>
                              <td style={{ maxWidth: 260 }}>{Array.isArray(item.reasons) && item.reasons.length > 0 ? item.reasons[0] : '—'}</td>
                              <td>
                                {isTop ? (
                                  <span className="dx-mini-badge">Recommended</span>
                                ) : (
                                  <button type="button" className="btn-dx-primary"
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                    onClick={() => openModal(item, true)}>
                                    Override
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="dx-action-row">
                {top && (
                  <button
                    type="button"
                    className="btn-dx-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => openModal(top, false)}
                  >
                    <CheckCircle2 size={16} /> Assign This Driver
                  </button>
                )}
                <button type="button" className="btn-dx-secondary" onClick={() => setPendingAssign(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {pendingAssign && (
        <AssignConfirmModal
          job={selected}
          candidate={pendingAssign.candidate}
          isOverride={pendingAssign.isOverride}
          onConfirm={handleConfirm}
          onCancel={() => { if (!submitting) setPendingAssign(null) }}
          submitting={submitting}
          error={modalError}
        />
      )}
    </section>
  )
}

export default AssignDriverVehiclePage
