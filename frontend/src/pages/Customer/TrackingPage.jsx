import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import { trackDelivery } from '../../api/customer'

function TrackingPage() {
  const location = useLocation()
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [pollKey, setPollKey] = useState(null)
  const lastUpdate = Array.isArray(result?.timeline) && result.timeline.length > 0
    ? result.timeline[result.timeline.length - 1]?.at
    : null

  useEffect(() => {
    const prefill = typeof location.state?.prefillTracking === 'string' ? location.state.prefillTracking.trim() : ''
    if (prefill) {
      setCode(prefill)
    }
  }, [location.state?.prefillTracking])

  const loadTrack = useCallback(async (trackingCode) => {
    const response = await trackDelivery(trackingCode)
    setResult(response)
  }, [])

  const handleTrack = async () => {
    setError('')
    setResult(null)

    if (!code) {
      setError('Enter a tracking code.')
      return
    }

    try {
      await loadTrack(code.trim())
      setPollKey(code.trim())
    } catch (err) {
      setError(err.message)
      setPollKey(null)
    }
  }

  useEffect(() => {
    if (!pollKey) {
      return undefined
    }
    const interval = setInterval(() => {
      loadTrack(pollKey).catch(() => {
        /* keep last good payload */
      })
    }, 15000)
    return () => clearInterval(interval)
  }, [pollKey, loadTrack])

  return (
    <section className="tracking-page" aria-labelledby="tracking-title">
      <header className="tracking-header">
        <div className="header-stack">
          <p className="tracking-eyebrow">Customer Tracking</p>
          <h1 id="tracking-title">Track your delivery</h1>
          <p>View masked delivery status, ETA, and proof-of-delivery signals with your Job Order ID.</p>
        </div>
        <div className="tracking-header-aside">
          <Link className="tracking-back" to="/">
            Home
          </Link>
          <span className="tracking-badge">No account required</span>
          <span className="tracking-badge tracking-badge--muted">Support: (+63) 917-123-4567</span>
        </div>
      </header>

      {error && (
        <p className="notice error tracking-notice" role="alert">
          {error}
        </p>
      )}

      <div className="tracking-grid">
        <form
          className="tracking-card tracking-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleTrack()
          }}
          aria-label="Track a delivery"
        >
          <label className="tracking-label" htmlFor="tracking-id">
            Tracking ID
          </label>
          <div className="tracking-input-row">
            <input
              id="tracking-id"
              type="text"
              placeholder="Enter tracking ID"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-describedby="tracking-help"
              aria-invalid={Boolean(error)}
              autoComplete="off"
            />
            <button type="submit" className="btn primary">
              Track delivery
            </button>
          </div>
          <div className="tracking-actions">
            <button type="button" className="btn ghost" onClick={() => setAssistantOpen(true)}>
              Open assistant
            </button>
            {pollKey && (
              <span className="tracking-pill" role="status">
                Auto-refresh every 15 seconds
              </span>
            )}
          </div>
          <p className="tracking-hint" id="tracking-help">
            Example: JO-2026-00432
          </p>
        </form>

        <div className="tracking-card tracking-status" aria-live="polite">
          <div className="tracking-status-header">
            <div>
              <h2>Status overview</h2>
              <p>Latest updates from dispatch and delivery logs.</p>
            </div>
            <span className="tracking-pill tracking-pill--muted">
              Last update: {lastUpdate ? new Date(lastUpdate).toLocaleString() : '—'}
            </span>
          </div>

          {!result ? (
            <p className="tracking-empty">Enter a tracking ID to view status.</p>
          ) : (
            <div className="tracking-stack">
              {result.delay_flag ? (
                <div className="tracking-alert" role="status">
                  This delivery appears past the scheduled window. Our team may contact you with an update.
                </div>
              ) : null}

              <div className="tracking-metrics">
                <div>
                  <span>Status</span>
                  <strong>{result.status ?? '—'}</strong>
                </div>
                <div>
                  <span>ETA</span>
                  <strong>{result.eta_window ?? '—'}</strong>
                </div>
                <div>
                  <span>Approx. location</span>
                  <strong>
                    {result.approximate_location
                      ? `${result.approximate_location.lat}, ${result.approximate_location.lng}`
                      : 'Unavailable'}
                  </strong>
                </div>
              </div>

              <div className="tracking-section">
                <h3>Proof of delivery</h3>
                {Array.isArray(result.proof_documents) && result.proof_documents.length > 0 ? (
                  <ul className="tracking-docs">
                    {result.proof_documents.map((p, i) => (
                      <li key={i}>
                        <span>{p.type}</span>
                        <span>
                          Uploaded {p.uploaded_at ? new Date(p.uploaded_at).toLocaleString() : '—'}
                        </span>
                        <span>{p.ocr_ready ? 'Processing complete' : 'Processing'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tracking-muted">
                    Proof of delivery documents are available after completion for authenticated users.
                  </p>
                )}
              </div>

              {Array.isArray(result.timeline) && result.timeline.length > 0 ? (
                <div className="tracking-section">
                  <h3>Timeline</h3>
                  <ul className="tracking-timeline">
                    {result.timeline.map((row, i) => (
                      <li key={i}>
                        <div className="tracking-time">
                          {row.at ? new Date(row.at).toLocaleString() : '—'}
                        </div>
                        <div>
                          <strong>{row.status}</strong>
                          {row.notes ? <span className="tracking-note">{row.notes}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <DeliverexAssistantChat open={assistantOpen} onOpenChange={setAssistantOpen} />
    </section>
  )
}

export default TrackingPage
