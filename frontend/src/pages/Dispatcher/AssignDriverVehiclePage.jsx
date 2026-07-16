import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createAssignment, fetchJobOrders, getBestFit } from '../../api/dispatcher'
import { useToast } from '../../context/ToastContext'
import BestFitExplainability, { formatScore } from '../../components/BestFitExplainability'
import { IconRouteArrow } from '../../components/DxIcons'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus } from '../../utils/statusLabels'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatJobSchedule } from '../../utils/driverAssignment'
import { PaginationBar } from '../../components/ui'
import { AlertTriangle, CheckCircle2, Loader2, Truck, User, Zap } from 'lucide-react'

// ─── Priority helpers ──────────────────────────────────────────────────────────
const LICENSE_WARNING = "This driver cannot be assigned because the driver's license information is incomplete or expired."

const PRIORITY_BADGE = {
  urgent: { label: 'URGENT', color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5' },
  high:   { label: 'HIGH',   color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  normal: { label: 'NORMAL', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  low:    { label: 'LOW',    color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.normal
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em',
      padding: '1px 7px', borderRadius: 99,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  )
}

/* ── Confirm / Override Modal ──────────────────────────────── */
function AssignConfirmModal({ job, candidate, recommendedTop, isOverride, overrideReason, onOverrideReasonChange, onConfirm, onCancel, submitting, error }) {
  return (
    <div className="dx-modal-backdrop" onClick={onCancel}>
      <div className="dx-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-labelledby="assign-modal-title">
        <div className="dx-modal-header">
          <h2 id="assign-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOverride
              ? <><AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} /> Override Assignment</>
              : <><CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} /> Confirm Assignment</>}
          </h2>
          <button type="button" className="dx-modal-close" onClick={onCancel} disabled={submitting}>×</button>
        </div>

        <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isOverride && (
            <>
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.875rem', color: '#92400e', display: 'flex', gap: 8 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                This overrides the Best-Fit recommendation. Document your reason below.
              </div>
              {recommendedTop && (
                <div style={{ background: 'var(--slate-50)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--stroke)', fontSize: '0.8125rem' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>System recommendation</p>
                  <strong>{recommendedTop.driver_name}</strong>{recommendedTop.vehicle_plate ? ` · ${recommendedTop.vehicle_plate}` : ''}
                  {recommendedTop.score != null && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--muted)' }}>Score: {formatScore(recommendedTop)}</span>}
                </div>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Override reason <span style={{ color: 'var(--color-error)' }}>*</span></span>
                <textarea value={overrideReason} onChange={(e) => onOverrideReasonChange(e.target.value)}
                  placeholder="e.g. Driver A unavailable by phone" rows={3}
                  style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--stroke)', font: 'inherit', fontSize: '0.875rem', resize: 'vertical' }} />
              </label>
            </>
          )}

          {/* Summary */}
          <div style={{ background: 'var(--slate-50)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--stroke)', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{formatJobPublicId(job.id)}</span>
              <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{job.priority} priority</span>
            </div>
            <p style={{ fontWeight: 600, margin: '0 0 3px' }}>{job.client?.client_name || job.custom_client_name || buildDisplayName(job)}</p>
            <p style={{ color: 'var(--muted)', margin: 0 }}>{buildDisplayAddress('pickup', job)} → {buildDisplayAddress('dropoff', job)}</p>
          </div>

          <div className="dx-grid-2 dx-grid-2--10">
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: '0 0 5px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={11} /> Driver
              </p>
              <strong style={{ fontSize: '0.9375rem' }}>{candidate.driver_name}</strong>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: '0 0 5px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Truck size={11} /> Vehicle
              </p>
              <strong style={{ fontSize: '0.9375rem' }}>{candidate.vehicle_plate}</strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                {[candidate.vehicle_type, candidate.vehicle_cbm_capacity ? `${candidate.vehicle_cbm_capacity} m³` : candidate.vehicle_capacity].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>

          <BestFitExplainability candidate={candidate} compact />

          {error && (
            <p style={{ margin: 0, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-dx-primary" style={{ flex: 1, justifyContent: 'center', background: isOverride ? '#d97706' : undefined, borderColor: isOverride ? '#d97706' : undefined }}
              onClick={onConfirm} disabled={submitting || (isOverride && !overrideReason.trim())}>
              {submitting ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Assigning…</> : isOverride ? 'Confirm Override' : 'Confirm Assignment'}
            </button>
            <button type="button" className="btn-dx-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Candidate Card ─────────────────────────────────────────── */
function CandidateCard({ item, isTop, onAssign, onOverride }) {
  const topFactor = Array.isArray(item.factors) && item.factors.length > 0
    ? [...item.factors]
      .filter((f) => f.key !== 'distance')
      .sort((a, b) => b.contribution - a.contribution)[0]
    : null
  const noAccount = item.driver_has_account === false

  return (
    <div style={{
      border: `1.5px solid ${isTop ? 'var(--color-primary)' : 'var(--stroke)'}`,
      borderRadius: 12,
      padding: '14px 16px',
      background: isTop ? 'linear-gradient(135deg, #eff6ff, #fff)' : '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
    }}>
      {isTop && (
        <span style={{ position: 'absolute', top: -11, left: 12, background: 'var(--color-primary)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '2px 10px', borderRadius: 99, letterSpacing: '0.04em' }}>
          ★ RECOMMENDED
        </span>
      )}

      {/* Driver + Vehicle */}
      <div className="dx-grid-2 dx-grid-2--8" style={{ marginTop: isTop ? 4 : 0 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={10} /> Driver
          </p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem' }}>{item.driver_name}</p>
          {noAccount && (
            <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.6875rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 99 }}>
              No login account
            </span>
          )}
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Truck size={10} /> Vehicle
          </p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem' }}>{item.vehicle_plate}</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
            {[item.vehicle_type, item.vehicle_cbm_capacity != null ? `${item.vehicle_cbm_capacity} m³` : item.vehicle_capacity].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      {/* Score + Top Factor */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '1.125rem', fontWeight: 800, color: isTop ? 'var(--color-primary)' : 'var(--text)',
            background: isTop ? '#dbeafe' : 'var(--slate-100)', padding: '2px 10px', borderRadius: 8, letterSpacing: '-0.01em',
          }}>
            {formatScore(item) ?? '—'}
          </span>
          {item.unused_capacity != null && (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {item.unused_capacity} m³ unused
            </span>
          )}
        </div>
        {topFactor && (
          <span style={{ fontSize: '0.75rem', color: topFactor.matched ? 'var(--color-success)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            {topFactor.matched ? '✓' : '✗'} {topFactor.label}
          </span>
        )}
      </div>

      {/* Explainability (top card only) */}
      {isTop && <BestFitExplainability candidate={item} compact />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {isTop ? (
          <button type="button" className="btn-dx-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onAssign} disabled={noAccount}>
            <CheckCircle2 size={15} /> {noAccount ? 'Generate account first' : 'Assign Recommended'}
          </button>
        ) : (
          <>
            <button type="button" className="btn-dx-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem' }} onClick={onOverride}>
              <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} /> Override &amp; Assign
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────── */
function AssignDriverVehiclePage() {
  const toast = useToast()
  const [jobOrders, setJobOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [recommended, setRecommended] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [overrideOptions, setOverrideOptions] = useState({ drivers: [], vehicles: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [pendingAssign, setPendingAssign] = useState(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const [manualDriverId, setManualDriverId] = useState('')
  const [manualVehicleId, setManualVehicleId] = useState('')
  const [overrideTab, setOverrideTab] = useState('suggested')
  const [altPage, setAltPage] = useState(1)
  const [altPerPage] = useState(6)

  const location = useLocation()
  const preselectJobId = location.state?.jobOrderId ?? null

  const loadJobs = async () => {
    try {
      const res = await fetchJobOrders(1)
      const pending = (res.data || []).filter((item) => item.status === 'pending')
      // Sort: priority (urgent → high → normal → low) then scheduled_start asc
      const sorted = [...pending].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 2
        const pb = PRIORITY_ORDER[b.priority] ?? 2
        if (pa !== pb) return pa - pb
        const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity
        const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity
        return ta - tb
      })
      setJobOrders(sorted)
      setSelected((prev) => {
        if (preselectJobId) {
          const requested = pending.find((p) => p.id === preselectJobId)
          if (requested) return requested
        }
        if (prev && pending.some((p) => p.id === prev.id)) return prev
        return pending[0] ?? null
      })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadJobs() }, []) // eslint-disable-line

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setRecommended(null)
    setRecommendations([])
    setOverrideOptions({ drivers: [], vehicles: [] })
    setManualDriverId('')
    setManualVehicleId('')
    setOverrideTab('suggested')
    setAltPage(1)
    getBestFit(selected.id)
      .then((res) => {
        setRecommended(res.recommended || null)
        setRecommendations(res.recommendations || [])
        setOverrideOptions(res.override_options || { drivers: [], vehicles: [] })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selected])

  const openModal = (candidate, isOverride = false) => {
    if (!selected) { setError('Select a job order first.'); return }
    setModalError('')
    setOverrideReason('')
    setPendingAssign({ candidate, isOverride })
  }

  const handleConfirm = async () => {
    if (!pendingAssign || !selected) return
    setSubmitting(true)
    setModalError('')
    try {
      await createAssignment({
        job_order_id: selected.id,
        driver_id: pendingAssign.candidate.driver_id,
        vehicle_id: pendingAssign.candidate.vehicle_id,
        ...(pendingAssign.isOverride ? { override_reason: overrideReason.trim() } : {}),
      })
      setPendingAssign(null)
      toast(
        `Dispatched — ${pendingAssign.candidate.driver_name} assigned. Driver has been notified.`,
        'success',
      )
      await loadJobs()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openManualOverride = () => {
    if (!selected) {
      setError('Select a job order first.')
      return
    }

    const driver = overrideOptions.drivers.find((d) => String(d.id) === String(manualDriverId))
    const vehicle = overrideOptions.vehicles.find((v) => String(v.id) === String(manualVehicleId))

    if (!driver || !vehicle) {
      setError('Select an available driver and vehicle for override.')
      return
    }

    if (driver.eligible === false) {
      setError(driver.message || LICENSE_WARNING)
      return
    }

    const candidate = {
      driver_id: driver.id,
      driver_name: driver.name,
      vehicle_id: vehicle.id,
      vehicle_plate: vehicle.plate_no,
      vehicle_type: vehicle.vehicle_type,
      vehicle_cbm_capacity: vehicle.cbm_capacity,
      factors: [],
      reasons: ['Manual override selection from currently available resources'],
    }

    openModal(candidate, true)
  }

  const top = recommended || recommendations[0]
  const alternatives = recommendations.filter((r) =>
    !(top && r.driver_id === top.driver_id && r.vehicle_id === top.vehicle_id)
  )

  const altTotalPages = Math.max(1, Math.ceil(alternatives.length / altPerPage))
  const safeAltPage = Math.min(altPage, altTotalPages)

  const paginatedAlternatives = useMemo(
    () => alternatives.slice((safeAltPage - 1) * altPerPage, safeAltPage * altPerPage),
    [alternatives, safeAltPage, altPerPage],
  )

  useEffect(() => {
    if (altPage > altTotalPages) setAltPage(altTotalPages)
  }, [altPage, altTotalPages])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Fleet Dispatch</h1>
          <p>Best-Fit recommendations with scored explainability — assign or override</p>
        </div>
      </header>

      {error && <p className="notice error" style={{ marginBottom: 14 }}>{error}</p>}

      {/* 3-column layout: Jobs | Recommended | Alternatives */}
      <div className="dx-dispatch-grid">

        {/* ── Column 1: Job Queue ── */}
        <div className="dx-dispatch-grid__col">
          <div className="dx-dispatch-grid__col-header" style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--navy)' }}>{jobOrders.length}</strong> pending
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Select job ↓</span>
          </div>
          <div className="dx-dispatch-grid__scroll">
          {jobOrders.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              No unassigned jobs.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobOrders.map((order) => {
              const isActive = selected?.id === order.id
              return (
                <button key={order.id} type="button"
                  onClick={() => setSelected(order)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--stroke)'}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                    background: isActive ? '#eff6ff' : '#fff',
                    boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem', color: isActive ? 'var(--color-primary)' : 'var(--muted)' }}>
                      {formatJobPublicId(order.id)}
                    </span>
                    <PriorityBadge priority={order.priority} />
                  </div>
                  <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.875rem' }}>
                    {order.client?.client_name || order.custom_client_name || buildDisplayName(order)}
                  </p>
                  <p style={{ margin: '0 0 3px', color: 'var(--muted)', fontSize: '0.75rem' }}>
                    {[order.material_type, order.specification_size].filter(Boolean).join(' · ') || 'Material not set'}
                  </p>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{buildDisplayAddress('pickup', order)}</span>
                    <span style={{ flexShrink: 0 }}><IconRouteArrow /></span>
                    <span>{buildDisplayAddress('dropoff', order)}</span>
                  </p>
                  {(order.scheduled_start || order.scheduled_end) && (
                    <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      {formatJobSchedule(order)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
          </div>
        </div>

        {/* ── Column 2: Recommended ── */}
        <div className="dx-dispatch-grid__col">
          <div className="dx-dispatch-grid__scroll">
          {!selected ? (
            <div style={{ background: '#fff', border: '1px dashed var(--stroke)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              <Zap size={28} style={{ marginBottom: 10, opacity: 0.3 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Select a job order to see the Best-Fit recommendation</p>
            </div>
          ) : loading ? (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={20} style={{ animation: 'spin 0.7s linear infinite' }} />
              Analyzing fleet…
            </div>
          ) : top ? (
            <div>
              {/* Job context strip */}
              <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      {formatJobPublicId(selected.id)} · {selected.client?.client_name || selected.custom_client_name || buildDisplayName(selected)}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {[selected.material_type, selected.specification_size].filter(Boolean).join(' · ')}
                      {(selected.load_volume_m3 || selected.volume_m3) ? ` · ${selected.load_volume_m3 ?? selected.volume_m3} m³` : ''}
                    </p>
                  </div>
                  {(selected.scheduled_start || selected.scheduled_end) && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {formatJobSchedule(selected)}
                    </span>
                  )}
                </div>

                {top?.load_efficiency_percent != null && (
                  <div style={{
                    marginTop: 10,
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 11px', borderRadius: 8,
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600,
                  }}>
                    ✓ Load Efficiency: {top.load_efficiency_percent}%
                  </div>
                )}
              </div>

              {/* Top recommendation card */}
              <CandidateCard
                item={top}
                isTop
                onAssign={() => openModal(top, false)}
                onOverride={() => openModal(top, false)}
              />
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>No recommendations available</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 14 }}>No available drivers or vehicles match the requirements.</p>
              <a href="/admin/master-data" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600 }}>
                Check fleet availability in Master Data →
              </a>
            </div>
          )}
          </div>
        </div>

        {/* ── Column 3: Alternative Matches ── */}
        <div className="dx-dispatch-grid__col">
          <div className="dx-dispatch-grid__col-header" style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700 }}>
              {alternatives.length > 0 ? `${alternatives.length} alternative ${alternatives.length === 1 ? 'match' : 'matches'}` : 'Alternative Matches'}
            </p>
            {alternatives.length > 0 && (
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>Override the recommendation by assigning any match below</p>
            )}
          </div>

          <div className="dx-dispatch-grid__col-header dx-filter-tabs" role="tablist" aria-label="Override options" style={{ marginBottom: 10 }}>
            <button
              type="button"
              role="tab"
              aria-selected={overrideTab === 'suggested'}
              className={`dx-filter-tab${overrideTab === 'suggested' ? ' dx-filter-tab--active' : ''}`}
              onClick={() => setOverrideTab('suggested')}
            >
              Suggested
              <span className="dx-filter-tab__badge">{alternatives.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={overrideTab === 'all'}
              className={`dx-filter-tab${overrideTab === 'all' ? ' dx-filter-tab--active' : ''}`}
              onClick={() => setOverrideTab('all')}
            >
              All Drivers
              <span className="dx-filter-tab__badge">{overrideOptions.drivers.length}</span>
            </button>
          </div>

          <div className="dx-dispatch-grid__scroll">
          {/* Safe manual override selector (uses same assignment endpoint) */}
          {!!selected && !loading && overrideTab === 'all' && (
            <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 700, color: '#92400e' }}>
                All Available Drivers
              </p>
              <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                Select from all available drivers and feasible vehicles, then confirm override.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <select
                  value={manualDriverId}
                  onChange={(e) => setManualDriverId(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid var(--stroke)', fontSize: '0.8125rem' }}
                >
                  <option value="">Select available driver…</option>
                  {overrideOptions.drivers.map((d) => (
                    <option key={d.id} value={d.id} disabled={!d.has_login_account || d.eligible === false}>
                      {d.name}
                      {!d.has_login_account ? ' (no account)' : ''}
                      {d.eligible === false ? ' (license ineligible)' : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={manualVehicleId}
                  onChange={(e) => setManualVehicleId(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid var(--stroke)', fontSize: '0.8125rem' }}
                >
                  <option value="">Select available vehicle…</option>
                  {overrideOptions.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_no}{v.vehicle_type ? ` · ${v.vehicle_type}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-dx-secondary"
                  onClick={openManualOverride}
                  disabled={!manualDriverId || !manualVehicleId}
                  style={{ justifyContent: 'center', fontSize: '0.8125rem' }}
                >
                  <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} /> Review Manual Override
                </button>
              </div>
            </div>
          )}

          {overrideTab === 'all' ? null : !selected || loading ? (
            <div style={{ background: '#fff', border: '1px dashed var(--stroke)', borderRadius: 12, padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              {loading ? 'Loading…' : 'Select a job to see alternatives.'}
            </div>
          ) : alternatives.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              {top ? 'Only one match available.' : 'No matches found.'}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {paginatedAlternatives.map((item) => (
                  <CandidateCard
                    key={`${item.driver_id}-${item.vehicle_id}`}
                    item={item}
                    isTop={false}
                    onOverride={() => openModal(item, true)}
                  />
                ))}
              </div>
            </>
          )}
          </div>
          {overrideTab === 'suggested' && alternatives.length > 0 && (
            <div className="dx-dispatch-grid__col-footer">
              <PaginationBar
                page={safeAltPage}
                perPage={altPerPage}
                total={alternatives.length}
                onPage={setAltPage}
              />
            </div>
          )}
        </div>
      </div>

      {pendingAssign && (
        <AssignConfirmModal
          job={selected}
          candidate={pendingAssign.candidate}
          recommendedTop={top}
          isOverride={pendingAssign.isOverride}
          overrideReason={overrideReason}
          onOverrideReasonChange={setOverrideReason}
          onConfirm={handleConfirm}
          onCancel={() => { if (!submitting) { setPendingAssign(null); setOverrideReason('') } }}
          submitting={submitting}
          error={modalError}
        />
      )}
    </section>
  )
}

export default AssignDriverVehiclePage
