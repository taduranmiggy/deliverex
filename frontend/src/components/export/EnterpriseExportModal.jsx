import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Loader2, X } from 'lucide-react'
import { fetchExportPreview } from '../../api/export'
import { useExportWorkflow } from '../../hooks/useExportWorkflow'
import { ExportProgressPanel, ExportSuccessPanel, PdfPreviewPanel } from './ExportPhasePanels'
import {
  DATE_PRESETS,
  DEFAULT_EXPORT_PRESET,
  presetToDates,
} from '../../utils/export/exportDatePresets'
import { loadExportSession, saveExportSession } from '../../utils/export/exportSession'
import { AUDIT_INCLUDE_OPTIONS } from '../../utils/audit/exportConfig'

function cleanParams(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && v !== '' && v !== 'all'),
  )
}

/**
 * Enterprise export modal — date presets, filters, count preview, PDF in-browser preview,
 * progress steps, and success screen. Used by Manager Reports, OCR, and similar modules.
 */
function EnterpriseExportModal({
  open,
  onClose,
  sessionKey,
  previewReportKey,
  title,
  subtitle,
  onExport,
  initialFilters = {},
  filterFields = [],
  formatOptions = ['pdf'],
  defaultFormat = 'pdf',
  includeOptionsConfig = null,
  children = null,
  buildExtraParams = () => ({}),
}) {
  const [datePreset, setDatePreset] = useState(DEFAULT_EXPORT_PRESET)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [allRecords, setAllRecords] = useState(false)
  const [format, setFormat] = useState(defaultFormat)
  const [filters, setFilters] = useState(initialFilters)
  const [includeOptions, setIncludeOptions] = useState(() =>
    Object.fromEntries((includeOptionsConfig ?? AUDIT_INCLUDE_OPTIONS).map((o) => [o.key, o.default])),
  )
  const [preview, setPreview] = useState({ count: null, loading: false, error: '', truncated: false, dateRange: '' })

  const queryParams = useMemo(() => {
    const base = cleanParams({
      ...filters,
      ...buildExtraParams(),
      ...(includeOptionsConfig !== false ? includeOptions : {}),
    })
    if (allRecords || datePreset === 'all') {
      return cleanParams({ ...base, all_records: true, date_preset: 'all' })
    }
    return cleanParams({
      ...base,
      date_preset: datePreset !== 'custom' ? datePreset : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
  }, [allRecords, datePreset, dateFrom, dateTo, filters, buildExtraParams, includeOptions, includeOptionsConfig])

  const handleSaveSession = useCallback((exportFormat, params) => {
    saveExportSession(sessionKey, {
      datePreset,
      dateFrom,
      dateTo,
      allRecords,
      format: exportFormat,
      filters: params,
      includeOptions,
    })
  }, [sessionKey, datePreset, dateFrom, dateTo, allRecords, includeOptions])

  const {
    phase,
    progressStep,
    exportResult,
    pdfPreviewUrl,
    exportError,
    setExportError,
    previewLoading,
    resetWorkflow,
    runExport,
    runPdfPreview,
    downloadAgain,
    backToForm,
  } = useExportWorkflow({ onExport, onSaveSession: handleSaveSession })

  useEffect(() => {
    if (!open) return
    const session = loadExportSession(sessionKey) ?? {}
    const preset = session.datePreset ?? DEFAULT_EXPORT_PRESET
    const [from, to] = presetToDates(preset)
    setDatePreset(preset)
    setDateFrom(session.dateFrom ?? from ?? '')
    setDateTo(session.dateTo ?? to ?? '')
    setAllRecords(session.allRecords ?? preset === 'all')
    setFormat(session.format ?? defaultFormat)
    setFilters({ ...initialFilters, ...(session.filters ?? {}) })
    if (session.includeOptions) setIncludeOptions(session.includeOptions)
    resetWorkflow()
  }, [open, sessionKey, defaultFormat]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPreview = useCallback(async () => {
    if (!open || !previewReportKey) return
    setPreview((p) => ({ ...p, loading: true, error: '' }))
    try {
      const res = await fetchExportPreview(previewReportKey, queryParams)
      setPreview({
        count: res.export_count ?? res.count ?? 0,
        loading: false,
        error: '',
        truncated: Boolean(res.truncated),
        dateRange: res.date_range ?? '',
      })
    } catch (err) {
      setPreview({ count: 0, loading: false, error: err.message || 'Preview failed.', truncated: false, dateRange: '' })
    }
  }, [open, previewReportKey, queryParams])

  useEffect(() => {
    if (!open || phase !== 'form') return undefined
    const timer = setTimeout(loadPreview, 350)
    return () => clearTimeout(timer)
  }, [open, phase, loadPreview])

  const handlePreset = (id) => {
    setDatePreset(id)
    if (id === 'all') {
      setAllRecords(true)
      setDateFrom('')
      setDateTo('')
      return
    }
    setAllRecords(false)
    if (id === 'custom') return
    const [from, to] = presetToDates(id)
    setDateFrom(from ?? '')
    setDateTo(to ?? '')
  }

  const handlePreviewReport = async () => {
    if ((preview.count ?? 0) <= 0) {
      await loadPreview()
      return
    }
    await runPdfPreview(queryParams)
  }

  if (!open) return null

  const previewCount = preview.count ?? 0
  const canExport = previewCount > 0 && !preview.loading
  const includeOpts = includeOptionsConfig ?? AUDIT_INCLUDE_OPTIONS
  const showFormatPicker = formatOptions.length > 1

  return (
    <div className="dx-audit-export-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`dx-audit-export-modal dx-pop-in${phase === 'pdf-preview' ? ' dx-audit-export-modal--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'form' && (
          <>
            <header className="dx-audit-export-modal__header">
              <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <button type="button" className="dx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </header>

            <div className="dx-audit-export-modal__body">
              {showFormatPicker && (
                <section className="dx-audit-export-section">
                  <h3>Export Format</h3>
                  <div className="dx-audit-export-format">
                    {formatOptions.map((id) => {
                      const label = id === 'pdf' ? 'PDF (Recommended)' : id.toUpperCase()
                      return (
                        <label key={id} className={`dx-audit-export-format__option${format === id ? ' is-active' : ''}`}>
                          <input type="radio" name={`export-format-${sessionKey}`} checked={format === id} onChange={() => setFormat(id)} />
                          <FileText size={16} />
                          <span>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}

              <section className="dx-audit-export-section">
                <h3>Date Range</h3>
                <div className="dx-audit-export-chips">
                  {DATE_PRESETS.map((p) => (
                    <button key={p.id} type="button" className={datePreset === p.id ? 'is-active' : ''} onClick={() => handlePreset(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {(datePreset === 'custom' || (!allRecords && datePreset !== 'all')) && (
                  <div className="dx-audit-export-dates">
                    <label>Date From<input type="date" value={dateFrom} onChange={(e) => { setDatePreset('custom'); setAllRecords(false); setDateFrom(e.target.value) }} /></label>
                    <label>Date To<input type="date" value={dateTo} onChange={(e) => { setDatePreset('custom'); setAllRecords(false); setDateTo(e.target.value) }} /></label>
                  </div>
                )}
              </section>

              {filterFields.length > 0 && (
                <section className="dx-audit-export-section">
                  <h3>Filters</h3>
                  <div className="dx-audit-export-section--grid2" style={{ display: 'grid', gap: 12 }}>
                    {filterFields.map((field) => (
                      <label key={field.key}>
                        {field.label}
                        {field.type === 'select' ? (
                          <select
                            value={filters[field.key] ?? field.defaultValue ?? ''}
                            onChange={(e) => setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          >
                            {(field.options ?? []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder={field.placeholder}
                            value={filters[field.key] ?? ''}
                            onChange={(e) => setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {children}

              {includeOptionsConfig !== false && (
                <section className="dx-audit-export-section">
                  <h3>Include Options</h3>
                  <div className="dx-audit-export-checkgrid">
                    {includeOpts.map((o) => (
                      <label key={o.key}>
                        <input
                          type="checkbox"
                          checked={Boolean(includeOptions[o.key])}
                          onChange={(e) => setIncludeOptions((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </section>
              )}

              <section className="dx-audit-export-preview">
                {preview.loading ? (
                  <span><Loader2 size={16} className="dx-spin" /> Counting matching records…</span>
                ) : preview.error ? (
                  <span className="is-error">{preview.error}</span>
                ) : previewCount > 0 ? (
                  <strong>{Number(previewCount).toLocaleString()} record{previewCount === 1 ? '' : 's'} will be exported.</strong>
                ) : (
                  <span>No data found for the selected filters.</span>
                )}
                {preview.truncated && <small>Export capped at 10,000 rows.</small>}
                {preview.dateRange && <small style={{ display: 'block', marginTop: 6 }}>Range: {preview.dateRange}</small>}
              </section>

              {exportError && <p className="notice error">{exportError}</p>}
            </div>

            <footer className="dx-audit-export-modal__footer">
              <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-dx-secondary" onClick={handlePreviewReport} disabled={preview.loading || previewLoading || !canExport}>
                {previewLoading ? <><Loader2 size={15} className="dx-spin" /> Generating preview…</> : <><Eye size={15} /> Preview Report</>}
              </button>
              {formatOptions.includes('pdf') && (
                <button type="button" className="btn-dx-primary" onClick={() => runExport('pdf', queryParams)} disabled={!canExport}>
                  <Download size={15} /> Download PDF
                </button>
              )}
            </footer>
          </>
        )}

        {phase === 'pdf-preview' && pdfPreviewUrl && (
          <PdfPreviewPanel
            url={pdfPreviewUrl}
            filename={exportResult?.filename}
            onBack={backToForm}
            onExport={() => runExport('pdf', queryParams)}
          />
        )}

        {phase === 'progress' && <ExportProgressPanel step={progressStep} />}

        {phase === 'success' && (
          <ExportSuccessPanel
            filename={exportResult?.filename}
            onDownloadAgain={downloadAgain}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

export default EnterpriseExportModal
