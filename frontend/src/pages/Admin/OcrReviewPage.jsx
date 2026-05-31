import { useCallback, useEffect, useState } from 'react'
import { fetchDocumentPreviewBlob, fetchOcrQueue, reprocessOcr, validateOcr } from '../../api/admin'
import { EmptyState, PageHeader } from '../../components/ui'
import { Check, FileSearch, Flag, RefreshCw, X } from 'lucide-react'
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
  processed:    { cls: 'badge-dx badge-dx--enroute',     label: 'Ready for Review' },
  completed:    { cls: 'badge-dx badge-dx--enroute',     label: 'Ready for Review' },
  needs_review: { cls: 'badge-dx badge-dx--reviewing',   label: 'Needs Review' },
  validated:    { cls: 'badge-dx badge-dx--validated',   label: 'Validated' },
  failed:       { cls: 'badge-dx badge-dx--failed',      label: 'Failed' },
}

function isReadyToApprove(status) {
  return ['processed', 'completed', 'needs_review'].includes(status)
}

function OcrReviewPage() {
  const [queue, setQueue]           = useState([])
  const [error, setError]           = useState('')
  const [msg, setMsg]               = useState('')
  const [selected, setSelected]     = useState(null)
  const [tab, setTab]               = useState('all')
  const [corrected, setCorrected]   = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState('')

  const load = useCallback(async (filter = 'all') => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchOcrQueue(1, filter)
      const data = res.data || []
      setQueue(data)
      setSelected((prev) => data.find((d) => d.id === prev?.id) ?? data[0] ?? null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab) }, [tab]) // eslint-disable-line

  useEffect(() => {
    const needsPoll = queue.some((q) => ['pending', 'processing'].includes(q.processing_status))
    if (!needsPoll) return undefined
    const iv = setInterval(() => load(tab), 4000)
    return () => clearInterval(iv)
  }, [queue, tab, load])

  useEffect(() => {
    if (selected) {
      setCorrected(selected.corrected_text ?? selected.extracted_text ?? '')
      setRejectReason(selected.error_message ?? '')
    }
  }, [selected])

  const documentId = selected?.document_id ?? selected?.document?.id

  useEffect(() => {
    let revoked = null
    setPreviewError('')
    setPreviewUrl(null)

    if (!documentId) return undefined

    let cancelled = false
    fetchDocumentPreviewBlob(documentId)
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        revoked = url
        setPreviewUrl(url)
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err.message)
      })

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [documentId])

  const handleAction = async (action) => {
    if (!selected) return
    setSubmitting(true)
    setMsg('')
    setError('')
    try {
      await validateOcr(selected.id, {
        action,
        corrected_text: action === 'approve' ? corrected : undefined,
        reject_reason:  action !== 'approve' ? rejectReason : undefined,
      })
      setMsg({ approve: 'Document validated and saved.', reject: 'Document rejected.', flag: 'Document flagged for review.' }[action])
      load(tab)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReprocess = async () => {
    if (!documentId) return
    setSubmitting(true)
    setMsg('')
    setError('')
    try {
      await reprocessOcr(documentId)
      setMsg('OCR reprocessed. Results will refresh shortly.')
      await load(tab)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getBadge = (item) => STATUS_MAP[item.processing_status] ?? { cls: 'badge-dx badge-dx--muted', label: item.processing_status ?? '—' }

  const canReprocess = selected && ['pending', 'processing', 'failed', 'processed', 'completed', 'needs_review'].includes(selected.processing_status)
  const isStub = selected?.engine === 'stub'
  const showTesseractWarning = isStub || (selected?.processing_status === 'failed' && selected?.error_message?.toLowerCase().includes('tesseract'))

  return (
    <>
      <PageHeader title="OCR Validation" subtitle="Review scanned delivery documents and validate extracted text" />
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}

      {showTesseractWarning && (
        <p className="notice error" style={{ marginBottom: 16 }}>
          <strong>Tesseract OCR is not installed or not configured.</strong>
          {' '}Install Tesseract, set <code>TESSERACT_PATH</code> in <code>backend/.env</code>, run{' '}
          <code>php artisan ocr:check</code>, restart <code>php artisan serve</code>, then click <strong>Reprocess OCR</strong>.
        </p>
      )}

      <div className="dx-ocr-grid">
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
                    {item.engine ? ` · ${item.engine}` : ''}
                  </div>
                </button>
              )
            })
          }
        </div>

        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Document Preview</h3>
          <div className="dx-preview-pane" style={{ minHeight: 280 }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Document preview"
                style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 12, objectFit: 'contain', boxShadow: 'var(--shadow-md)' }}
              />
            ) : previewError ? (
              <p className="notice error" style={{ margin: 0, fontSize: '0.875rem' }}>{previewError}</p>
            ) : documentId ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading preview…</p>
            ) : (
              <>
                <FileSearch size={48} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: '0.875rem' }}>Select a document to preview</p>
              </>
            )}
          </div>
        </div>

        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Extracted Text</h3>
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
                <label>Confidence
                  <input type="text" readOnly
                    value={selected.confidence_score != null
                      ? `${Math.round(Number(selected.confidence_score) * 100)}%`
                      : '—'}
                  />
                </label>
              </div>
              <label>Extracted / Corrected text
                <textarea rows={8} value={corrected} onChange={(e) => setCorrected(e.target.value)} placeholder="Edit extracted text before approving…" />
              </label>
              {selected.processing_status !== 'validated' && (
                <label>Reject / flag reason <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
                  <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection or flag…" />
                </label>
              )}
              {selected.error_message && (
                <p className={`notice${selected.processing_status === 'failed' || isStub ? ' error' : ''}`} style={{ margin: 0 }}>
                  {selected.error_message}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-dx-primary" type="button" disabled={submitting || !isReadyToApprove(selected.processing_status)} onClick={() => handleAction('approve')}
                  style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                  title={!isReadyToApprove(selected.processing_status) ? 'Wait until OCR completes or reprocess failed items' : 'Save validated record'}>
                  <Check size={15} /> Validate
                </button>
                <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={() => handleAction('reject')}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-mid)' }}>
                  <X size={15} /> Reject
                </button>
                <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={() => handleAction('flag')}>
                  <Flag size={15} /> Flag
                </button>
                {canReprocess && (
                  <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={handleReprocess}>
                    <RefreshCw size={15} /> Reprocess OCR
                  </button>
                )}
                <button className="btn-dx-secondary" type="button" disabled={loading} onClick={() => load(tab)}>
                  <RefreshCw size={15} /> Refresh
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
