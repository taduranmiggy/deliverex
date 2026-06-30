import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { trackDelivery } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerSkeleton from '../../components/customer/CustomerSkeleton'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import DeliveryProgressBar from '../../components/customer/DeliveryProgressBar'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { StatusBadge } from '../../components/ui'
import { formatEventAt, formatOfflineSyncLabel, getEventAt } from '../../utils/deliveryTimestamps'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, MapPin, MessageSquare, RefreshCw, Search } from 'lucide-react'

function TrackingPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { paths } = useCustomerSurface()
  const [code, setCode]         = useState('')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [pollKey, setPollKey]   = useState(null)

  const lastTimelineRow = Array.isArray(result?.timeline) && result.timeline.length > 0
    ? result.timeline.filter((row) => getEventAt(row)).at(-1)
    : null
  const lastUpdate = lastTimelineRow ? getEventAt(lastTimelineRow) : null

  const loadTrack = useCallback(async (trackingCode) => {
    const res = await trackDelivery(trackingCode)
    setResult(res)
    return res
  }, [])

  const queryCode = searchParams.get('code') ?? ''

  useEffect(() => {
    const fromState = location.state?.prefillTracking
    const resolved = (
      typeof fromState === 'string' && fromState.trim()
        ? fromState.trim()
        : typeof queryCode === 'string' && queryCode.trim()
          ? queryCode.trim()
          : ''
    )
    if (!resolved) return undefined

    setCode(resolved)

    let cancelled = false
    ;(async () => {
      setError('')
      setResult(null)
      setLoading(true)
      try {
        await loadTrack(resolved)
        if (!cancelled) setPollKey(resolved)
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setPollKey(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [location.state?.prefillTracking, queryCode, loadTrack])

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

  const homePath = paths.dashboard

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

        <div className="tracking-grid">
        {/* Search form */}
        <form className="tracking-card tracking-form pwa-track-card pwa-track-card--page" onSubmit={handleTrack} aria-label="Track a delivery" noValidate>
          <h2 className="pwa-track-card__title">Look up shipment</h2>
          <div className="pwa-track-search">
            <label className="pwa-track-search__label" htmlFor="tid">Tracking ID</label>
            <div className="pwa-track-search__row">
              <div className={`pwa-track-search__input-wrap${error ? ' pwa-track-search__input-wrap--invalid' : ''}`}>
                <Search size={18} className="pwa-track-search__icon" aria-hidden />
                <input
                  id="tid"
                  type="text"
                  className="pwa-track-search__input"
                  placeholder="e.g. XKFP2NQRLA"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    if (error) setError('')
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'track-error' : 'track-hint'}
                  autoComplete="off"
                  inputMode="text"
                />
              </div>
              <button type="submit" className="pwa-btn pwa-btn--primary pwa-track-search__submit" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <RefreshCw size={18} className="pwa-btn__spinner" aria-hidden />
                ) : (
                  <Search size={18} aria-hidden />
                )}
                <span>{loading ? 'Searching…' : 'Track Delivery'}</span>
              </button>
            </div>
            {error ? (
              <p id="track-error" className="pwa-track-search__error" role="alert">{error}</p>
            ) : (
              <p id="track-hint" className="pwa-track-search__hint">Example: XKFP2NQRLA</p>
            )}
          </div>
          <div className="tracking-actions">
            {pollKey && (
              <span className="tracking-pill" role="status" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={12} /> Refresh Status
              </span>
            )}
          </div>

          {/* How it works */}
          <div className="pwa-track-howto">
            <p className="pwa-track-howto__title">How it works</p>
            {['Get your Tracking ID from your dispatcher or provider.', 'Enter it above and tap Track Delivery.', 'View delivery status, ETA window, and proof-of-delivery documents.'].map((step, i) => (
              <div key={i} className="pwa-track-howto__step">
                <span className="pwa-track-howto__num" aria-hidden>{i + 1}</span>
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
                      {(result.completion_proof.submitted_event_at || result.completion_proof.submitted_at) && (
                        <div><strong>Submitted:</strong> {new Date(result.completion_proof.submitted_event_at || result.completion_proof.submitted_at).toLocaleString()}</div>
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
                            Uploaded {(p.uploaded_event_at || p.uploaded_at) ? new Date(p.uploaded_event_at || p.uploaded_at).toLocaleString() : '—'}
                          </span>
                          {p.type !== 'signature' && (
                            <span className={`badge-dx ${p.ocr_ready ? 'badge-dx--completed' : 'badge-dx--dispatched'}`}>
                              {p.ocr_ready ? 'Verified' : 'Processing'}
                            </span>
                          )}
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
                            >
                              View <ExternalLink size={11} />
                            </a>
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
                        <div className="tracking-time">{formatEventAt(row) ?? '—'}</div>
                        <div>
                          <StatusBadge status={row.status} />
                          {row.status === 'arrived' && row.arrival_verified && (
                            <span className="badge-dx badge-dx--completed" style={{ marginLeft: 8, fontSize: '0.7rem' }}>
                              GPS Verified
                            </span>
                          )}
                          {formatOfflineSyncLabel(row) && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                              {formatOfflineSyncLabel(row)}
                            </div>
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
