import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import { trackDelivery } from '../../api/customer'

function TrackingPage() {
  const location = useLocation()
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [pollKey, setPollKey] = useState(null)

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
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Customer Tracking</h1>
          <p>View masked delivery status, ETA, timeline, and proof-of-delivery signals.</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}
      <div className="split">
        <div className="card form-grid">
          <label>
            Tracking ID
            <input
              type="text"
              placeholder="Enter tracking ID"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button type="button" className="btn primary" onClick={handleTrack}>
            Track Delivery
          </button>
          <button type="button" className="btn ghost" onClick={() => setAssistantOpen(true)}>
            Open Chatbot
          </button>
          {pollKey && <p className="notice" style={{ margin: 0 }}>Auto-refresh every 15 seconds.</p>}
        </div>
        <div className="card">
          <h3>Status</h3>
          {result ? (
            <div className="stack">
              {result.delay_flag ? (
                <p className="notice error" style={{ marginTop: 0 }}>
                  This delivery appears past the scheduled window. Our team may contact you with an update.
                </p>
              ) : null}
              <p><strong>Status:</strong> {result.status}</p>
              <p><strong>ETA:</strong> {result.eta_window}</p>
              <p>
                <strong>Approximate location:</strong>{' '}
                {result.approximate_location
                  ? `${result.approximate_location.lat}, ${result.approximate_location.lng}`
                  : 'Unavailable'}
              </p>
              {Array.isArray(result.proof_documents) && result.proof_documents.length > 0 ? (
                <div>
                  <strong>Proof of delivery</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '1.1rem' }}>
                    {result.proof_documents.map((p, i) => (
                      <li key={i}>
                        {p.type} — uploaded {p.uploaded_at ? new Date(p.uploaded_at).toLocaleString() : '—'}
                        {p.ocr_ready ? ' (verified text available to operations)' : ' (processing)'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Array.isArray(result.timeline) && result.timeline.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <strong>Timeline</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
                    {result.timeline.map((row, i) => (
                      <li key={i}>
                        {row.at ? new Date(row.at).toLocaleString() : '—'} — {row.status}
                        {row.notes ? ` (${row.notes})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p>Enter a tracking ID to view status.</p>
          )}
        </div>
      </div>
      <DeliverexAssistantChat open={assistantOpen} onOpenChange={setAssistantOpen} />
    </section>
  )
}

export default TrackingPage
