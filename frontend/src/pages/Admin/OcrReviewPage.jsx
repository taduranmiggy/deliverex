import { useEffect, useState } from 'react'
import { fetchOcrQueue } from '../../api/admin'
import { IconCheckSmall, IconDocOutline, IconFlagOutline } from '../../components/DxIcons'
import { formatJobPublicId } from '../../utils/formatPhp'

const TABS = ['All', 'Waiting', 'Flagged', 'Validated']

function OcrReviewPage() {
  const [queue, setQueue] = useState([])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('All')

  useEffect(() => {
    const loadQueue = async () => {
      try {
        const response = await fetchOcrQueue(1)
        const data = response.data || []
        setQueue(data)
        setSelected(data[0] ?? null)
      } catch (err) {
        setError(err.message)
      }
    }

    loadQueue()
  }, [])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>OCR Validation</h1>
          <p>Review and validate scanned delivery documents</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-ocr-grid">
        <div className="dx-panel">
          <div className="dx-ocr-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`dx-ocr-tab${tab === t ? ' dx-ocr-tab--active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {queue.map((item, idx) => {
            const st = idx % 2 === 0 ? 'Waiting' : 'Flagged'
            const isPrimary = idx % 2 === 0
            return (
              <button
                key={item.id}
                type="button"
                className={`dx-doc-queue-item ${item.id === selected?.id ? 'dx-doc-queue-item--active' : ''}`}
                onClick={() => setSelected(item)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>DOC-{String(item.id).padStart(3, '0')}</strong>
                  <span className={`badge-dx ${isPrimary ? 'badge-dx--enroute' : 'badge-dx--pending'}`}>
                    {st}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: 6 }}>
                  {item.document?.assignment?.job_order?.customer_name ?? 'Client record'}
                </div>
              </button>
            )
          })}
          {queue.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No documents in queue.</p>
          )}
        </div>

        <div className="dx-panel">
          <h3 className="dx-panel-title">Image Preview</h3>
          <div className="dx-preview-pane">
            <div>
              <div className="dx-ocr-preview-doc" aria-hidden>
                <IconDocOutline />
              </div>
              <div>
                Document: DOC-{selected ? String(selected.id).padStart(3, '0') : '—'} scanned delivery receipt
              </div>
            </div>
          </div>
        </div>

        <div className="dx-panel">
          <h3 className="dx-panel-title">Extracted Fields</h3>
          {selected ? (
            <div className="form-grid">
              <label>
                Client
                <span className="dx-confidence high" style={{ float: 'right' }}>
                  High
                </span>
                <input
                  type="text"
                  defaultValue={
                    selected.document?.assignment?.job_order?.customer_name ?? 'Maria Santos'
                  }
                />
              </label>
              <label>
                Job ID
                <span className="dx-confidence high" style={{ float: 'right' }}>
                  High
                </span>
                <input
                  type="text"
                  defaultValue={
                    selected.document?.assignment?.job_order_id
                      ? formatJobPublicId(selected.document.assignment.job_order_id)
                      : 'J-2026-001'
                  }
                />
              </label>
              <label>
                Quantity
                <span className="dx-confidence medium" style={{ float: 'right' }}>
                  Medium
                </span>
                <input type="text" defaultValue="10 tons" />
              </label>
              <label>
                Material
                <span className="dx-confidence high" style={{ float: 'right' }}>
                  High
                </span>
                <input type="text" defaultValue="Gravel" />
              </label>
              <label>
                Amount
                <span className="dx-confidence high" style={{ float: 'right' }}>
                  High
                </span>
                <input type="text" defaultValue="₱12,450.00" />
              </label>
              <label>
                Date
                <span className="dx-confidence medium" style={{ float: 'right' }}>
                  Medium
                </span>
                <input type="text" defaultValue="2026-05-11" />
              </label>
              <label style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                <input type="checkbox" defaultChecked /> Proof of delivery present
              </label>
              <label>
                Reject reason <span style={{ fontWeight: 400 }}>(optional)</span>
                <textarea rows={3} placeholder="Enter reason for rejection or flag…" />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button className="btn-dx-primary" type="button">
                  <span className="dx-btn-with-icon">
                    <IconCheckSmall /> Approve
                  </span>
                </button>
                <button className="btn-dx-secondary" type="button">
                  Reject
                </button>
                <button type="button" className="btn-dx-secondary" aria-label="Flag document">
                  <span className="dx-btn-with-icon">
                    <IconFlagOutline /> Flag
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <p>Select a document to review.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default OcrReviewPage
