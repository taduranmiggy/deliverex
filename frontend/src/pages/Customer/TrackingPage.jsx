import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { trackDelivery } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import { StatusBadge } from '../../components/ui'
import { AlertTriangle, Clock, MapPin, MessageSquare, RefreshCw, Search } from 'lucide-react'

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

  return (
    <div className="tracking-page">
      {/* Header */}
      <header className="tracking-header">
        <div className="header-stack">
          <p className="tracking-eyebrow">Customer Tracking</p>
          <h1>Track your delivery</h1>
          <p>View live status, ETA windows, and proof-of-delivery updates.</p>
        </div>
        <div className="tracking-header-aside">
          <Link className="tracking-back" to="/customer">← Customer portal</Link>
          <span className="tracking-badge">No account required</span>
          <button type="button" className="btn-dx-secondary btn-sm" onClick={() => setChatOpen(true)}>
            <MessageSquare size={14} /> Help
          </button>
        </div>
      </header>

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
                <RefreshCw size={12} /> Auto-refresh every 15 s
              </span>
            )}
          </div>
          <p className="tracking-hint">Example: XKFP2NQRLA</p>

          {/* How it works */}
          <div style={{ marginTop: 24, padding: '18px', background: 'var(--slate-50)', borderRadius: 12, border: '1px solid var(--stroke)' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 12 }}>How it works</p>
            {['Get your Tracking ID from your dispatcher or provider.', 'Enter it above and click Track.', 'View live status, ETA window, and proof-of-delivery documents.'].map((step, i) => (
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
              <h2>Status overview</h2>
              <p>Latest updates from dispatch and delivery logs.</p>
            </div>
            <span className="tracking-pill tracking-pill--muted" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={11} />
              {lastUpdate ? new Date(lastUpdate).toLocaleString() : '—'}
            </span>
          </div>

          {!result ? (
            <div className="tracking-empty">
              <Search size={40} style={{ opacity: 0.15, margin: '0 auto 12px' }} />
              <p>Enter a tracking ID to view status.</p>
            </div>
          ) : (
            <div className="tracking-stack">
              {/* Delay alert */}
              {result.delay_flag && (
                <div className="tracking-alert" role="alert">
                  <AlertTriangle size={16} style={{ display: 'inline', marginRight: 8 }} />
                  This delivery appears past the scheduled window. Our team may contact you with an update.
                </div>
              )}

              {/* Metrics */}
              <div className="tracking-metrics">
                <div>
                  <span>Status</span>
                  <strong><StatusBadge status={result.status} /></strong>
                </div>
                <div>
                  <span>ETA</span>
                  <strong style={{ fontSize: '0.875rem' }}>{result.eta_window ?? '—'}</strong>
                </div>
                <div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} /> Location</span>
                  <strong style={{ fontSize: '0.875rem' }}>
                    {result.approximate_location
                      ? `${result.approximate_location.lat}, ${result.approximate_location.lng}`
                      : 'Unavailable'}
                  </strong>
                </div>
              </div>

              {/* POD */}
              {Array.isArray(result.proof_documents) && result.proof_documents.length > 0 && (
                <div className="tracking-section">
                  <h3>Proof of delivery</h3>
                  <ul className="tracking-docs">
                    {result.proof_documents.map((p, i) => (
                      <li key={i}>
                        <span style={{ fontWeight: 600 }}>{p.type}</span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                          Uploaded {p.uploaded_at ? new Date(p.uploaded_at).toLocaleString() : '—'}
                        </span>
                        <span className={`badge-dx ${p.ocr_ready ? 'badge-dx--completed' : 'badge-dx--dispatched'}`}>
                          {p.ocr_ready ? 'Verified' : 'Processing'}
                        </span>
                      </li>
                    ))}
                  </ul>
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
                          {row.notes && <span className="tracking-note">{row.notes}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}

export default TrackingPage
