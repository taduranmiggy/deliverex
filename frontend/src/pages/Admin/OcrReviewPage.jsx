import { useCallback, useEffect, useState } from 'react'
import { fetchOcrQueue, validateOcr } from '../../api/admin'
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui'
import { Check, FileSearch, Flag, X } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'

const FILTER_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'waiting',   label: 'Waiting' },
  { key: 'flagged',   label: 'Flagged' },
  { key: 'validated', label: 'Validated' },
]

const STATUS_MAP = {
  pending:      { cls: 'badge-dx badge-dx--pending',     label: 'Pending' },
  processing:   { cls: 'badge-dx badge-dx--dispatched',  label: 'Processing' },
  completed:    { cls: 'badge-dx badge-dx--enroute',     label: 'Waiting Review' },
  needs_review: { cls: 'badge-dx badge-dx--reviewing',   label: 'Flagged' },
  validated:    { cls: 'badge-dx badge-dx--validated',   label: 'Validated' },
  failed:       { cls: 'badge-dx badge-dx--failed',      label: 'Rejected' },
}

function OcrReviewPage() {
  const [queue, setQueue]     = useState([])
  const [error, setError]     = useState('')
  const [msg, setMsg]         = useState('')
  const [selected, setSelected] = useState(null)
  const [tab, setTab]         = useState('all')
  const [corrected, setCorrected]     = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (filter = 'all') => {
    setLoading(true); setError('')
    try {
      const res = await fetchOcrQueue(1, filter)
      const data = res.data || []
      setQueue(data)
      setSelected((prev) => data.find((d) => d.id === prev?.id) ?? data[0] ?? null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab) }, [tab]) // eslint-disable-line

  useEffect(() => {
    if (selected) {
      setCorrected(selected.corrected_text ?? selected.extracted_text ?? '')
      setRejectReason(selected.error_message ?? '')
    }
  }, [selected])

  const handleAction = async (action) => {
    if (!selected) return
    setSubmitting(true); setMsg(''); setError('')
    try {
      await validateOcr(selected.id, {
        action,
        corrected_text: action === 'approve' ? corrected : undefined,
        reject_reason:  action !== 'approve' ? rejectReason : undefined,
      })
      setMsg({ approve: '✓ Document approved.', reject: 'Document rejected.', flag: 'Document flagged for review.' }[action])
      load(tab)
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  const getBadge = (item) => STATUS_MAP[item.processing_status] ?? { cls: 'badge-dx badge-dx--muted', label: item.processing_status ?? '—' }
  const storageBase = (import.meta.env.VITE_API_URL ?? '').replace('/api', '')

  return (
    <>
      <PageHeader title="OCR Validation" subtitle="Review and validate scanned delivery documents" />
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}

      <div className="dx-ocr-grid">
        {/* Queue list */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div className="dx-ocr-tabs">
            {FILTER_TABS.map((t) => (
              <button key={t.key} type="button" className={`dx-ocr-tab${tab === t.key ? ' dx-ocr-tab--active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          {loading ? <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '12px 0' }}>Loading…</p> :
            queue.length === 0 ? <EmptyState icon={FileSearch} title="Queue empty" message="No documents in this category." /> :
            queue.map((item) => {
              const b = getBadge(item)
              return (
                <button key={item.id} type="button"
                  className={`dx-doc-queue-item${item.id === selected?.id ? ' dx-doc-queue-item--active' : ''}`}
                  onClick={() => setSelected(item)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>DOC-{String(item.id).padStart(3, '0')}</strong>
                    <span className={b.cls}>{b.label}</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: 6 }}>
                    {item.document?.assignment?.job_order?.customer_name ?? 'Client record'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--subtle)', marginTop: 3, textTransform: 'capitalize' }}>
                    {item.document?.type ?? 'document'}
                  </div>
                </button>
              )
            })
          }
        </div>

        {/* Image preview */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Document Preview</h3>
          <div className="dx-preview-pane" style={{ minHeight: 280 }}>
            {selected?.document?.file_path ? (
              <img
                src={`${storageBase}/storage/${selected.document.file_path}`}
                alt="Document preview"
                style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 12, objectFit: 'contain', boxShadow: 'var(--shadow-md)' }}
              />
            ) : (
              <>
                <FileSearch size={48} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: '0.875rem' }}>
                  {selected ? `DOC-${String(selected.id).padStart(3, '0')}` : 'Select a document to preview'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Review panel */}
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Extracted Fields</h3>
          {!selected ? (
            <EmptyState icon={FileSearch} title="No document selected" message="Select a document from the queue to review." />
          ) : (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>Client
                  <input type="text" readOnly value={selected.document?.assignment?.job_order?.customer_name ?? '—'} />
                </label>
                <label>Job ID
                  <input type="text" readOnly value={selected.document?.assignment?.job_order_id ? formatJobPublicId(selected.document.assignment.job_order_id) : '—'} />
                </label>
                <label>Type
                  <input type="text" readOnly value={selected.document?.type ?? '—'} />
                </label>
                <label>Engine / Status
                  <input type="text" readOnly value={[selected.engine, selected.processing_status].filter(Boolean).join(' · ') || '—'} />
                </label>
              </div>
              <label>Extracted / Corrected text
                <textarea rows={5} value={corrected} onChange={(e) => setCorrected(e.target.value)} placeholder="Extracted or corrected text…" />
              </label>
              {selected.processing_status !== 'validated' && (
                <label>Reject / flag reason <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
                  <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection or flag…" />
                </label>
              )}
              {selected.error_message && (
                <p className="notice error" style={{ margin: 0 }}>{selected.error_message}</p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-dx-primary" type="button" disabled={submitting} onClick={() => handleAction('approve')}
                  style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  <Check size={15} /> Approve
                </button>
                <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={() => handleAction('reject')}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-mid)' }}>
                  <X size={15} /> Reject
                </button>
                <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={() => handleAction('flag')}>
                  <Flag size={15} /> Flag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default OcrReviewPage
