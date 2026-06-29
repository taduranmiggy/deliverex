import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportOcrReport, fetchDocumentPreviewBlob, fetchOcrQueue, reprocessOcr, validateOcr } from '../../api/admin'
import ExportConfirmModal from '../../components/ExportConfirmModal'
import { EmptyState, PageHeader, PaginationBar } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useAuth from '../../hooks/useAuth'
import { Check, FileSearch, Flag, Info, Loader2, RefreshCw, X } from 'lucide-react'
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

const REVIEW_STATUS_BADGE = {
  pending_review: { cls: 'badge-dx badge-dx--pending', label: 'Pending Review' },
  verified: { cls: 'badge-dx badge-dx--validated', label: 'Verified' },
  flagged: { cls: 'badge-dx badge-dx--reviewing', label: 'Flagged' },
  rejected: { cls: 'badge-dx badge-dx--failed', label: 'Rejected' },
}

const ISSUE_TYPES = [
  { value: '', label: 'Select issue type (optional)' },
  { value: 'missing_data', label: 'Missing data' },
  { value: 'poor_image_quality', label: 'Poor image quality' },
  { value: 'wrong_upload', label: 'Wrong upload' },
  { value: 'incomplete_document', label: 'Incomplete document' },
  { value: 'other', label: 'Other' },
]

function formatIssueType(issueType) {
  if (!issueType) return '—'
  if (issueType === 'ocr_mismatch') return 'Poor image quality'
  return issueType.replaceAll('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function formatSuggestionValue(value) {
  if (value == null) return ''
  if (typeof value === 'number') return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })
  return String(value)
}

function formatConfidencePct(score) {
  if (score == null || Number.isNaN(Number(score))) return null
  return `${Math.round(Number(score) * 100)}%`
}

function confidenceTone(score) {
  const n = Number(score)
  if (!Number.isFinite(n) || n <= 0) return 'low'
  if (n >= 0.85) return 'high'
  if (n >= 0.65) return 'medium'
  return 'low'
}

function OcrReviewPage() {
  const toast = useToast()
  const { user } = useAuth()
  const roleName = String(user?.role?.name || '').toLowerCase()
  const isAdmin = roleName === 'admin'
  const isDispatcher = roleName === 'dispatcher'
  const isReadOnly = !isAdmin
  const [queue, setQueue]           = useState([])
  const [error, setError]           = useState('')
  const [selected, setSelected]     = useState(null)
  const [tab, setTab]               = useState('all')
  const [corrected, setCorrected]   = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [issueType, setIssueType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [showExportSummary, setShowExportSummary] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jobOrderIdFilter, setJobOrderIdFilter] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [expandedAlternatives, setExpandedAlternatives] = useState({})
  const loadRequestId = useRef(0)

  const load = useCallback(async (filter = 'all', pageNum = page) => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    setError('')
    try {
      const res = await fetchOcrQueue(pageNum, filter, {
        per_page: perPage,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        job_order_id: jobOrderIdFilter || undefined,
      })
      if (requestId !== loadRequestId.current) return
      const data = res.data || []
      setQueue(data)
      setTotal(res.total ?? data.length)
      setSelected((prev) => data.find((d) => d.id === prev?.id) ?? data[0] ?? null)
    } catch (err) {
      if (requestId !== loadRequestId.current) return
      setError(err.message)
    } finally {
      if (requestId === loadRequestId.current) setLoading(false)
    }
  }, [dateFrom, dateTo, statusFilter, jobOrderIdFilter, page, perPage])

  useEffect(() => { load(tab, page) }, [tab, page, load])

  const clearFilters = () => {
    setPage(1)
    setDateFrom('')
    setDateTo('')
    setStatusFilter('all')
    setJobOrderIdFilter('')
  }

  const hasActiveFilters = Boolean(dateFrom || dateTo || statusFilter !== 'all' || jobOrderIdFilter)

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
      setReviewNotes(selected.review_notes ?? '')
      setIssueType('')
      setExpandedAlternatives({})
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
    setError('')
    const ACTION_MSGS = {
      approve: 'Document validated and saved.',
      reject:  'Document rejected.',
      flag:    'Document flagged for review.',
    }
    try {
      await validateOcr(selected.id, {
        action,
        corrected_text: action === 'approve' ? corrected : undefined,
        reject_reason:  action !== 'approve' ? rejectReason : undefined,
        notes: reviewNotes || undefined,
        issue_type: action !== 'approve' ? issueType || undefined : undefined,
      })
      toast(ACTION_MSGS[action] ?? 'Action completed.', 'success')
      load(tab)
    } catch (err) {
      toast(err.message || 'Action failed. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReprocess = async () => {
    if (!documentId) return
    setSubmitting(true)
    setError('')
    try {
      await reprocessOcr(documentId)
      toast('OCR reprocessing started. Results will refresh shortly.', 'info')
      await load(tab)
    } catch (err) {
      toast(err.message || 'Reprocessing failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = async () => {
    if (isDispatcher) return
    setExporting(true)
    try {
      const blob = await exportOcrReport({
        filter: tab,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        job_order_id: jobOrderIdFilter || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const d = new Date()
      const datePart = `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}_${String(d.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `OCR_Report_${datePart}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast('OCR report exported successfully.', 'success')
    } catch (err) {
      toast(err.message || 'Failed to export OCR report.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleConfirmExport = async () => {
    await handleExport()
    setShowExportSummary(false)
  }

  const ocrExportSummary = useMemo(() => {
    const tabLabel = FILTER_TABS.find((t) => t.key === tab)?.label ?? tab
    const statusLabel = statusFilter === 'all' ? 'All statuses' : (REVIEW_STATUS_BADGE[statusFilter]?.label ?? statusFilter)
    const parts = [`Tab: ${tabLabel}`, `Status: ${statusLabel}`]
    if (jobOrderIdFilter) parts.push(`Job Order: ${jobOrderIdFilter}`)
    let dateRange = 'All records'
    if (dateFrom && dateTo) dateRange = `${dateFrom} – ${dateTo}`
    else if (dateFrom) dateRange = `From ${dateFrom}`
    else if (dateTo) dateRange = `Until ${dateTo}`
    return {
      report: 'OCR Review Export',
      dateRange,
      filters: parts.join(' · '),
      rows: total,
    }
  }, [tab, statusFilter, jobOrderIdFilter, dateFrom, dateTo, total])

  const getBadge = (item) => STATUS_MAP[item.processing_status] ?? { cls: 'badge-dx badge-dx--muted', label: item.processing_status ?? '—' }
  const getReviewBadge = (item) => REVIEW_STATUS_BADGE[item.review_status] ?? { cls: 'badge-dx badge-dx--muted', label: item.review_status ?? '—' }

  const canReprocess = selected && ['pending', 'processing', 'failed', 'processed', 'completed', 'needs_review'].includes(selected.processing_status)
  const isStub = selected?.engine === 'stub'
  const showTesseractWarning = isStub || (selected?.processing_status === 'failed' && selected?.error_message?.toLowerCase().includes('tesseract'))
  const diagnostics = selected?.ocr_diagnostics || {}
  const parserStatus = diagnostics?.parser_status
  const showsNoText = parserStatus === 'no_text' || String(selected?.extracted_text || '').startsWith('(No text detected')
  const parserMiss = parserStatus === 'parser_miss'
  const parserPartial = parserStatus === 'partial'
  const reviewSuggestions = diagnostics?.review_suggestions ?? {}
  const structuredHits = diagnostics?.structured_hits ?? {}
  const confidenceModel = diagnostics?.confidence_model ?? {}
  const fieldScores = confidenceModel?.field_scores ?? {}
  const overallConfidence = selected?.confidence_score
  const overallConfidenceLabel = formatConfidencePct(overallConfidence)

  const appendSuggestionToCorrection = (label, value) => {
    const line = `${label}: ${value}`
    setCorrected((prev) => {
      const current = String(prev || '').trim()
      if (!current) return line
      if (current.includes(line)) return current
      return `${current}\n${line}`
    })
  }

  const ocrRows = selected ? [
    { key: 'length', label: 'Length (cm)', value: selected.extracted_length },
    { key: 'width', label: 'Width (cm)', value: selected.extracted_width },
    { key: 'height', label: 'Height (cm)', value: selected.extracted_height },
    { key: 'volume', label: 'Volume (m³)', value: selected.extracted_volume },
    { key: 'delivery_receipt_number', label: 'Delivery Receipt No', value: selected.delivery_receipt_number },
  ] : []

  return (
    <>
      <PageHeader
        title="OCR Review"
        subtitle={isReadOnly
          ? 'View OCR results and delivery documents — read-only. Admin approval is required for final validation.'
          : isDispatcher
            ? 'Operational delivery verification using OCR data and system records'
            : 'System-wide OCR validation, oversight, and delivery audit review'}
      >
        {!isDispatcher && !isReadOnly && (
          <button type="button" className="btn-dx-primary" onClick={() => setShowExportSummary(true)} disabled={exporting || total === 0}>
            {exporting ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Exporting...</> : 'Export XLSX'}
          </button>
        )}
      </PageHeader>
      {isReadOnly && (
        <div className="dx-readonly-notice" style={{ marginBottom: 16 }}>
          <Info size={14} aria-hidden />
          Read-only view — only Admin can validate, flag/reject, and reprocess OCR.
        </div>
      )}
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ marginBottom: 16 }}>
        <div className="dx-filter-grid">
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Date From
            <input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value) }} />
          </label>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Date To
            <input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value) }} />
          </label>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Delivery Status
            <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value) }}>
              <option value="all">All</option>
              <option value="pending_review">Pending Review</option>
              <option value="verified">Verified</option>
              <option value="flagged">Flagged</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Job Order ID
            <input
              type="search"
              placeholder="e.g. 12345"
              value={jobOrderIdFilter}
              onChange={(e) => { setPage(1); setJobOrderIdFilter(e.target.value) }}
            />
          </label>
        </div>
        {hasActiveFilters && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-dx-secondary btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>

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
              <button key={t.key} type="button" className={`dx-ocr-tab${tab === t.key ? ' dx-ocr-tab--active' : ''}`} onClick={() => { setPage(1); setTab(t.key) }}>
                {t.label}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
              <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              Loading queue…
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="Queue empty"
              message={hasActiveFilters
                ? 'No documents match the current filters. Try Clear filters or switch tabs.'
                : 'No OCR records in the system yet. Entries appear here after a driver uploads a delivery receipt when the assignment status is Arrived or Completed.'}
              action={hasActiveFilters ? (
                <button type="button" className="btn-dx-secondary btn-sm" onClick={clearFilters}>Clear filters</button>
              ) : null}
            />
          ) : (
            <div className="dx-ocr-queue-scroll">
              {queue.map((item) => {
                const b = getBadge(item)
                return (
                  <button key={item.id} type="button"
                    className={`dx-doc-queue-item dx-doc-queue-item--compact${item.id === selected?.id ? ' dx-doc-queue-item--active' : ''}`}
                    onClick={() => setSelected(item)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>DOC-{String(item.id).padStart(3, '0')}</strong>
                      <span className={b.cls}>{b.label}</span>
                    </div>
                    <div className="dx-doc-queue-item__customer">
                      {item.document?.assignment?.job_order?.customer_name ?? 'Client record'}
                    </div>
                    <div className="dx-doc-queue-item__meta">
                      {item.document?.type ?? 'document'}
                      {item.engine ? ` · ${item.engine}` : ''}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className={getReviewBadge(item).cls}>{getReviewBadge(item).label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
          }
          {!loading && total > 0 && (
            <PaginationBar
              page={page}
              perPage={perPage}
              total={total}
              onPage={setPage}
              onPerPage={(n) => { setPerPage(n); setPage(1) }}
              perPageOptions={[5, 10, 25, 50]}
            />
          )}
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
          <h3 className="dx-panel-title">Final OCR Dataset</h3>
          {!selected ? (
            <EmptyState icon={FileSearch} title="No document selected" message="Select a document from the queue to review." />
          ) : (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="dx-grid-2 dx-grid-2--12">
                <div style={{ border: '1px solid var(--stroke)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>OCR Data</p>
                    {overallConfidenceLabel && (
                      <span className={`badge-dx badge-dx--${confidenceTone(overallConfidence) === 'high' ? 'validated' : confidenceTone(overallConfidence) === 'medium' ? 'reviewing' : 'failed'}`}>
                        OCR Confidence: {overallConfidenceLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 6, fontSize: '0.85rem' }}>
                    {ocrRows.map((row) => {
                      const missing = row.value == null || row.value === ''
                      const fieldScore = fieldScores[row.key]
                      const tone = confidenceTone(fieldScore)
                      const mediumConfidence = tone === 'medium' && !missing
                      const noHit = structuredHits[row.key] === false
                      const showNoMatch = missing || noHit
                      const suggestions = Array.isArray(reviewSuggestions[row.key]) ? reviewSuggestions[row.key] : []
                      const showSuggestions = suggestions.length > 0 && (tone !== 'high' || expandedAlternatives[row.key])
                      const fieldPct = formatConfidencePct(fieldScore)
                      return (
                        <div key={row.key}>
                          <div>
                            <strong>{row.label}:</strong> {missing ? '—' : row.value}
                            {fieldPct && !missing && (
                              <span style={{
                                marginLeft: 8,
                                fontSize: '0.72rem',
                                color: tone === 'high' ? 'var(--success)' : tone === 'medium' ? 'var(--warning, #b45309)' : 'var(--danger)',
                              }}>
                                {fieldPct}
                                {mediumConfidence && ' · review suggested'}
                              </span>
                            )}
                            {showNoMatch && (
                              <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: '0.75rem' }}>
                                No confident match found.
                              </span>
                            )}
                          </div>
                          {suggestions.length > 0 && tone === 'high' && !expandedAlternatives[row.key] && (
                            <button
                              type="button"
                              className="btn-dx-secondary btn-sm"
                              style={{ marginTop: 4, padding: '2px 8px', fontSize: '0.72rem' }}
                              onClick={() => setExpandedAlternatives((prev) => ({ ...prev, [row.key]: true }))}
                            >
                              Show alternatives
                            </button>
                          )}
                          {showSuggestions && (
                            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Suggested Values:</span>
                              {suggestions.map((entry, idx) => {
                                const shownValue = formatSuggestionValue(entry.value)
                                return (
                                  <button
                                    key={`${row.key}-${idx}-${shownValue}`}
                                    type="button"
                                    className="btn-dx-secondary btn-sm"
                                    disabled={isReadOnly || !shownValue}
                                    title={isReadOnly ? shownValue : `Use ${shownValue}`}
                                    onClick={() => appendSuggestionToCorrection(row.label, shownValue)}
                                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                  >
                                    {shownValue}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--stroke)', borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>System Data</p>
                  <div style={{ display: 'grid', gap: 6, fontSize: '0.85rem' }}>
                    <div><strong>Job Order:</strong> {selected.job_order_id ? formatJobPublicId(selected.job_order_id) : '—'}</div>
                    <div><strong>Assignment ID:</strong> {selected.assignment_id || '—'}</div>
                    <div><strong>Driver:</strong> {selected.driver_name || '—'}</div>
                    <div><strong>Driver ID:</strong> {selected.driver_id || '—'}</div>
                    <div><strong>Vehicle:</strong> {selected.vehicle_plate_no || '—'}</div>
                    <div><strong>Delivery Date:</strong> {selected.delivery_date ? new Date(selected.delivery_date).toLocaleString() : '—'}</div>
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--stroke)', borderRadius: 10, padding: 12, display: 'grid', gap: 6 }}>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Validation Result</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={
                    selected.validation_result?.match_status === 'matched'
                      ? 'badge-dx badge-dx--completed'
                      : selected.validation_result?.match_status === 'mismatch'
                        ? 'badge-dx badge-dx--failed'
                        : 'badge-dx badge-dx--reviewing'
                  }>
                    {selected.validation_result?.match_status === 'matched'
                      ? 'Matched'
                      : selected.validation_result?.match_status === 'mismatch'
                        ? 'Mismatch'
                        : 'Partial Match'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {selected.validation_result?.volume_delta_ratio != null
                      ? `Volume delta: ${(selected.validation_result.volume_delta_ratio * 100).toFixed(1)}%`
                      : 'Volume comparison unavailable'}
                  </span>
                </div>
                <div className="dx-grid-2 dx-grid-2--8" style={{ fontSize: '0.8125rem' }}>
                  <div><strong>Expected Volume:</strong> {selected.validation_result?.expected_volume ?? '—'}</div>
                  <div><strong>Extracted Volume:</strong> {selected.validation_result?.actual_volume ?? '—'}</div>
                </div>
              </div>

              <details style={{ border: '1px solid var(--stroke)', borderRadius: 10, padding: 12 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Raw OCR Text</summary>
                <pre style={{
                  marginTop: 10,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.76rem',
                  color: 'var(--muted)',
                  maxHeight: 180,
                  overflow: 'auto',
                }}
                >
                  {selected.extracted_text || '(No OCR text available)'}
                </pre>
              </details>

              {!isDispatcher && !isReadOnly && (
                <label>Reviewed OCR text (optional)
                  <textarea rows={5} value={corrected} onChange={(e) => setCorrected(e.target.value)} placeholder="Optional corrected OCR text…" />
                </label>
              )}

              {!isReadOnly && (
              <div className="dx-grid-2 dx-grid-2--10">
                <label>Issue Type
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                    {ISSUE_TYPES.map((it) => <option key={it.value} value={it.value}>{it.label}</option>)}
                  </select>
                </label>
                <label>Review Status
                  <input type="text" readOnly value={getReviewBadge(selected).label} />
                </label>
              </div>
              )}
              {isReadOnly && (
                <div className="dx-grid-2 dx-grid-2--10" style={{ fontSize: '0.875rem' }}>
                  <div><strong>Issue Type:</strong> {formatIssueType(selected.issue_type)}</div>
                  <div><strong>Review Status:</strong> {getReviewBadge(selected).label}</div>
                </div>
              )}
              {selected.document?.completion_proof && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.8125rem' }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Delivery Completion Proof</strong>
                  <div>Type: {selected.document.completion_proof.proof_type?.replace(/_/g, ' ') ?? '—'}</div>
                  {selected.document.completion_proof.receiver_name && (
                    <div>Receiver: {selected.document.completion_proof.receiver_name}</div>
                  )}
                  {selected.document.completion_proof.receiver_contact && (
                    <div>Contact: {selected.document.completion_proof.receiver_contact}</div>
                  )}
                  {selected.document.completion_proof.delivery_notes && (
                    <div style={{ marginTop: 4, color: 'var(--muted)' }}>{selected.document.completion_proof.delivery_notes}</div>
                  )}
                </div>
              )}
              {!isReadOnly && selected.processing_status !== 'validated' && (
                <label>Reject / flag reason <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
                  <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection or flag…" />
                </label>
              )}
              {!isReadOnly ? (
              <label>Reviewer Notes
                <textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add validation notes…" />
              </label>
              ) : selected.review_notes ? (
                <div style={{ fontSize: '0.875rem' }}>
                  <strong>Reviewer Notes:</strong>
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{selected.review_notes}</p>
                </div>
              ) : null}
              {selected.error_message && (
                <p className={`notice${selected.processing_status === 'failed' || isStub ? ' error' : ''}`} style={{ margin: 0 }}>
                  {selected.error_message}
                </p>
              )}
              {(showsNoText || parserMiss || parserPartial) && (
                <div className={`notice${showsNoText || parserMiss ? ' error' : ''}`} style={{ margin: 0 }}>
                  {showsNoText && (
                    <div><strong>No text detected.</strong> The image may be blurred, low contrast, too dark, or skewed. Try re-uploading a clearer image or click Reprocess OCR.</div>
                  )}
                  {parserMiss && (
                    <div><strong>Text detected, but structured fields were not parsed.</strong> OCR output exists, but receipt/dimensions pattern matching failed.</div>
                  )}
                  {parserPartial && !showsNoText && !parserMiss && (
                    <div><strong>Partial extraction.</strong> Some OCR fields were parsed, but important fields are still missing.</div>
                  )}
                </div>
              )}
              {!!selected?.ocr_diagnostics && (
                <details className="dx-ocr-diagnostics" style={{ border: '1px dashed var(--stroke)', borderRadius: 10, padding: 10, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  <summary style={{ color: 'var(--ink)', fontWeight: 700, cursor: 'pointer' }}>
                    Technical OCR Diagnostics
                  </summary>
                  <div style={{ marginTop: 8 }}>
                    <div>Parser status: {parserStatus || 'unknown'}</div>
                    {diagnostics?.chosen_variant && <div>Chosen variant: {diagnostics.chosen_variant}</div>}
                    {diagnostics?.chosen_psm && <div>Chosen PSM: {diagnostics.chosen_psm}</div>}
                    {Array.isArray(diagnostics?.candidate_scores) && diagnostics.candidate_scores.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        Top candidates: {diagnostics.candidate_scores.slice(0, 3).map((entry) => `${entry.variant}/psm${entry.psm} (${entry.score})`).join(' · ')}
                      </div>
                    )}
                  </div>
                </details>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!isReadOnly && (
                <>
                <button className="btn-dx-primary" type="button" disabled={submitting || !isReadyToApprove(selected.processing_status)} onClick={() => handleAction('approve')}
                  style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                  title={!isReadyToApprove(selected.processing_status) ? 'Wait until OCR completes or reprocess failed items' : 'Save validated record'}>
                  {submitting
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Approving…</>
                    : <><Check size={15} /> Approve Delivery</>}
                </button>
                <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={() => handleAction('reject')}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-mid)' }}>
                  {submitting ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Rejecting…</> : <><X size={15} /> Reject</>}
                </button>
                <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={() => handleAction('flag')}>
                  {submitting ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Flagging…</> : <><Flag size={15} /> Flag Delivery</>}
                </button>
                {!isDispatcher && canReprocess && (
                  <button className="btn-dx-secondary" type="button" disabled={submitting} onClick={handleReprocess}>
                    {submitting
                      ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Processing OCR…</>
                      : <><RefreshCw size={15} /> Reprocess OCR</>}
                  </button>
                )}
                </>
                )}
                <button className="btn-dx-secondary" type="button" disabled={loading || submitting} onClick={() => load(tab)}>
                  {loading ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Refreshing…</> : <><RefreshCw size={15} /> Refresh</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportConfirmModal
        open={showExportSummary}
        onClose={() => setShowExportSummary(false)}
        onConfirm={handleConfirmExport}
        reportName={ocrExportSummary.report}
        dateRange={ocrExportSummary.dateRange}
        filters={ocrExportSummary.filters}
        rows={ocrExportSummary.rows}
        confirmLabel="Download XLSX"
        confirming={exporting}
        infoNotice="All records matching the current filters will be exported from the server."
      />
    </>
  )
}

export default OcrReviewPage
