import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { trackDelivery } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerSkeleton from '../../components/customer/CustomerSkeleton'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import { isStandalonePwa } from '../../utils/pwaUtils'
import { StatusBadge } from '../../components/ui'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, MapPin, MessageSquare, Package, RefreshCw, Search, Truck } from 'lucide-react'

const DELIVERY_STEPS = [
  { key: 'pending',     label: 'Order Created',  icon: Package },
  { key: 'assigned',    label: 'Assigned',        icon: CheckCircle2 },
  { key: 'in_progress', label: 'En Route',        icon: Truck },
  { key: 'arrived',     label: 'Arrived',         icon: MapPin },
  { key: 'completed',   label: 'Delivered',       icon: CheckCircle2 },
]

const STATUS_STEP_INDEX = {
  pending: 0, assigned: 1, in_progress: 2, arrived: 3, completed: 4, cancelled: -1,
}

function DeliveryProgressBar({ status }) {
  const currentIdx = STATUS_STEP_INDEX[status] ?? 0
  if (status === 'cancelled') {
    return (
      <div className="tracking-alert" role="status">
        This delivery has been cancelled.
      </div>
    )
  }
  return (
    <div className="pwa-delivery-progress" aria-label="Delivery progress">
      <div className="pwa-delivery-progress__track">
        {DELIVERY_STEPS.map((step, idx) => {
          const done = idx < currentIdx
          const active = idx === currentIdx
          const Icon = step.icon
          return (
            <div key={step.key} className="pwa-delivery-progress__step">
              {idx < DELIVERY_STEPS.length - 1 && (
                <div className={`pwa-delivery-progress__connector${done ? ' pwa-delivery-progress__connector--done' : ''}`} aria-hidden />
              )}
              <div
                className={[
                  'pwa-delivery-progress__dot',
                  done || active ? 'pwa-delivery-progress__dot--done' : '',
                  active ? 'pwa-delivery-progress__dot--active pwa-timeline-step--active' : '',
                ].filter(Boolean).join(' ')}
              >
                <Icon size={16} color={done || active ? '#fff' : 'var(--muted)'} />
              </div>
              <span className={`pwa-delivery-progress__label${active ? ' pwa-delivery-progress__label--active' : ''}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrackingPage() {
  const location = useLocation()
  const [code, setCode]         = useState('')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [pollKey, setPollKey]   = useState(null)

  const lastUpdate = Array.isArray(result?.timeline) && result.timeline.length > 0
    ? result.timeline[result.timeline.length - 1]?.at : null

  useEffect(() => {
    const prefill = location.state?.prefillTracking
    if (typeof prefill === 'string' && prefill.trim()) {
      setCode(prefill.trim())
    }
  }, [location.state?.prefillTracking])

  const loadTrack = useCallback(async (trackingCode) => {
    const res = await trackDelivery(trackingCode)
    setResult(res)
    return res
  }, [])

  const handleTrack = async (e) => {
    if (e) e.preventDefault()
    if (!code.trim()) { setError('Enter a tracking code.'); return }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      await loadTrack(code.trim())
      setPollKey(code.trim())
    } catch (err) {
      setError(err.message)
      setPollKey(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!pollKey) return
    const iv = setInterval(() => loadTrack(pollKey).catch(() => {}), 15000)
    return () => clearInterval(iv)
  }, [pollKey, loadTrack])

  const homePath = isStandalonePwa() ? '/customer' : '/'

  return (
    <CustomerPageShell>
      <div className="tracking-page">
        <CustomerPageHeader
          eyebrow="Customer Tracking"
          title="Track your delivery"
          description="Monitor delivery progress, estimated arrival time, and proof-of-delivery information."
          aside={(
            <>
              <Link className="tracking-back" to={homePath}>← Back to home</Link>
              <span className="tracking-badge">No account required</span>
              <button type="button" className="btn-dx-secondary btn-sm" onClick={() => setChatOpen(true)}>
                <MessageSquare size={14} /> Help
              </button>
            </>
          )}
        />

        {error && <p className="notice error tracking-notice" role="alert">{error}</p>}

        <div className="tracking-grid">
        {/* Search form */}
        <form className="tracking-card tracking-form" onSubmit={handleTrack} aria-label="Track a delivery">
          <label className="tracking-label" htmlFor="tid">Tracking ID</label>
          <div className="tracking-input-row">
            <input
              id="tid" type="text" placeholder="Enter tracking ID" value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={Boolean(error)} autoComplete="off"
            />
            <button type="submit" className="btn-dx-primary" disabled={loading}>
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Search size={16} />}
              {loading ? 'Searching…' : 'Track'}
            </button>
          </div>
          <div className="tracking-actions">
            {pollKey && (
              <span className="tracking-pill" role="status" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={12} /> Refresh Status
              </span>
            )}
          </div>
          <p className="tracking-hint">Example: XKFP2NQRLA</p>

          {/* How it works */}
          <div style={{ marginTop: 24, padding: '18px', background: 'var(--slate-50)', borderRadius: 12, border: '1px solid var(--stroke)' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 12 }}>How it works</p>
            {['Get your Tracking ID from your dispatcher or provider.', 'Enter it above and click Track.', 'View delivery status, ETA window, and proof-of-delivery documents.'].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                {step}
              </div>
            ))}
          </div>
        </form>

        {/* Results */}
        <div className="tracking-card tracking-status" aria-live="polite">
          <div className="tracking-status-header">
            <div>
              <h2>Delivery Status</h2>
              <p>Current status, estimated arrival, and delivery confirmation.</p>
            </div>
            <span className="tracking-pill tracking-pill--muted" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={11} />
              {lastUpdate ? new Date(lastUpdate).toLocaleString() : '—'}
            </span>
          </div>

          {!result && loading ? (
            <CustomerSkeleton variant="tracking" />
          ) : !result ? (
            <div className="tracking-empty">
              <Search size={40} style={{ opacity: 0.15, margin: '0 auto 12px' }} />
              <p>Enter a tracking ID to view status.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={result.tracking_code}
                className="tracking-stack pwa-tracking-reveal"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
              {/* Progress bar */}
              <DeliveryProgressBar status={result.status} />

              {/* Delay alert */}
              {result.delay_flag && (
                <div className="tracking-alert" role="alert">
                  <AlertTriangle size={16} style={{ display: 'inline', marginRight: 8 }} />
                  This delivery appears past the scheduled window. Our team may contact you with an update.
                </div>
              )}

              {/* Tracking ID + ETA highlight */}
              <div style={{ padding: '16px 18px', borderRadius: 12, background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)', border: '1px solid #bfdbfe', marginBottom: 4 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Tracking ID</div>
                <div className="pwa-tracking-code">
                  {result.tracking_code}
                </div>
                <div className="tracking-eta-grid">
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Current Status</div>
                    <StatusBadge status={result.status} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Estimated Arrival</div>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                      {result.eta?.estimated_arrival_label ?? result.eta_window ?? '—'}
                    </strong>
                  </div>
                </div>
                {result.eta?.remaining_distance_label && result.status !== 'completed' && (
                  <div style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} />
                    <span>
                      <strong style={{ color: 'var(--text)' }}>{result.eta.remaining_distance_label}</strong>
                      {' '}remaining
                      {result.eta.average_speed_kmh ? ` · ~${result.eta.average_speed_kmh} km/h avg` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="tracking-metrics">
                <div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} /> Last Location</span>
                  <strong style={{ fontSize: '0.875rem', display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                    {result.approximate_location ? (
                      <>
                        <a
                          href={`https://maps.google.com/?q=${result.approximate_location.lat},${result.approximate_location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                        >
                          View on Map
                          <ExternalLink size={11} />
                        </a>
                        <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '0.8125rem' }}>
                          {result.approximate_location.lat}, {result.approximate_location.lng}
                        </span>
                      </>
                    ) : 'Unavailable'}
                  </strong>
                </div>
              </div>

              {result.proof_of_delivery_available && (
                <div className="tracking-alert" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }} role="status">
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 8 }} />
                  Proof of Delivery Available
                </div>
              )}

              {(result.completion_proof || (Array.isArray(result.proof_documents) && result.proof_documents.length > 0)) && (
                <div className="tracking-section">
                  <h3>Proof of delivery</h3>
                  {result.completion_proof && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 12 }}>
                      {result.completion_proof.proof_type_label && (
                        <div><strong>Type:</strong> {result.completion_proof.proof_type_label}</div>
                      )}
                      {result.completion_proof.receiver_name && (
                        <div><strong>Receiver:</strong> {result.completion_proof.receiver_name}</div>
                      )}
                      {result.completion_proof.receiver_contact && (
                        <div><strong>Contact:</strong> {result.completion_proof.receiver_contact}</div>
                      )}
                      {result.completion_proof.submitted_at && (
                        <div><strong>Submitted:</strong> {new Date(result.completion_proof.submitted_at).toLocaleString()}</div>
                      )}
                      {result.completion_proof.delivery_notes && (
                        <div style={{ marginTop: 4 }}>{result.completion_proof.delivery_notes}</div>
                      )}
                    </div>
                  )}
                  {Array.isArray(result.proof_documents) && result.proof_documents.length > 0 && (
                    <ul className="tracking-docs">
                      {result.proof_documents.map((p, i) => (
                        <li key={i}>
                          <span style={{ fontWeight: 600 }}>{p.label || p.type}</span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                            Uploaded {p.uploaded_at ? new Date(p.uploaded_at).toLocaleString() : '—'}
                          </span>
                          {p.type !== 'signature' && (
                            <span className={`badge-dx ${p.ocr_ready ? 'badge-dx--completed' : 'badge-dx--dispatched'}`}>
                              {p.ocr_ready ? 'Verified' : 'Processing'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Timeline */}
              {Array.isArray(result.timeline) && result.timeline.length > 0 && (
                <div className="tracking-section">
                  <h3>Delivery timeline</h3>
                  <ul className="tracking-timeline">
                    {result.timeline.map((row, i) => (
                      <li key={i}>
                        <div className="tracking-time">{row.at ? new Date(row.at).toLocaleString() : '—'}</div>
                        <div>
                          <StatusBadge status={row.status} />
                          {row.status === 'arrived' && row.arrival_verified && (
                            <span className="badge-dx badge-dx--completed" style={{ marginLeft: 8, fontSize: '0.7rem' }}>
                              GPS Verified
                            </span>
                          )}
                          {row.gps_verified_at && row.status === 'arrived' && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                              Verified at {new Date(row.gps_verified_at).toLocaleString()}
                            </div>
                          )}
                          {row.notes && <span className="tracking-note">{row.notes}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        </div>
      </div>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
      <LoadingOverlay open={loading} message="Loading delivery details" submessage="Please wait." />
    </CustomerPageShell>
  )
}

export default TrackingPage
