import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { fetchExportPreview } from '../api/export'
import {
  DATE_PRESETS,
  DEFAULT_EXPORT_PRESET,
  formatDateRangeLabel,
  presetToDates,
} from '../utils/export/exportDatePresets'
import { loadExportSession, saveExportSession } from '../utils/export/exportSession'

function cleanParams(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && v !== '' && v !== 'all'),
  )
}

/**
 * Advanced export modal — date presets, report filters, live preview count, format picker.
 */
function ExportReportModal({
  open,
  onClose,
  reportKey,
  reportTitle,
  onExport,
  initialFilters = {},
  filterFields = [],
  formatOptions = ['csv', 'xlsx', 'pdf'],
  defaultFormat = 'csv',
}) {
  const saved = useMemo(() => (reportKey ? loadExportSession(reportKey) : null), [reportKey, open])

  const [datePreset, setDatePreset] = useState(saved?.datePreset ?? DEFAULT_EXPORT_PRESET)
  const [dateFrom, setDateFrom] = useState(saved?.dateFrom ?? presetToDates(DEFAULT_EXPORT_PRESET)[0] ?? '')
  const [dateTo, setDateTo] = useState(saved?.dateTo ?? presetToDates(DEFAULT_EXPORT_PRESET)[1] ?? '')
  const [allRecords, setAllRecords] = useState(saved?.allRecords ?? false)
  const [format, setFormat] = useState(saved?.format ?? defaultFormat)
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    ...(saved?.filters ?? {}),
  }))
  const [preview, setPreview] = useState({ count: null, exportCount: null, loading: false, error: '', truncated: false })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    if (!open) return
    const session = reportKey ? loadExportSession(reportKey) : null
    const preset = session?.datePreset ?? DEFAULT_EXPORT_PRESET
    const [from, to] = presetToDates(preset)
    setDatePreset(preset)
    setDateFrom(session?.dateFrom ?? from ?? '')
    setDateTo(session?.dateTo ?? to ?? '')
    setAllRecords(session?.allRecords ?? preset === 'all')
    setFormat(session?.format ?? defaultFormat)
    setFilters({ ...initialFilters, ...(session?.filters ?? {}) })
    setExportError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once when modal opens
  }, [open, reportKey, defaultFormat])

  const queryParams = useMemo(() => {
    if (allRecords || datePreset === 'all') {
      return cleanParams({ all_records: true, date_preset: 'all', ...filters })
    }
    const params = {
      date_preset: datePreset !== 'custom' ? datePreset : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      ...filters,
    }
    return cleanParams(params)
  }, [allRecords, datePreset, dateFrom, dateTo, filters])

  const loadPreview = useCallback(async () => {
    if (!open || !reportKey) return
    setPreview((p) => ({ ...p, loading: true, error: '' }))
    try {
      const res = await fetchExportPreview(reportKey, queryParams)
      setPreview({
        count: res.count ?? 0,
        exportCount: res.export_count ?? res.count ?? 0,
        loading: false,
        error: '',
        truncated: Boolean(res.truncated),
        dateRange: res.date_range,
      })
    } catch (err) {
      setPreview({ count: 0, exportCount: 0, loading: false, error: err.message || 'Preview failed.', truncated: false })
    }
  }, [open, reportKey, queryParams])

  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(loadPreview, 350)
    return () => clearTimeout(timer)
  }, [open, loadPreview])

  const handlePresetChange = (presetId) => {
    setDatePreset(presetId)
    if (presetId === 'all') {
      setAllRecords(true)
      setDateFrom('')
      setDateTo('')
      return
    }
    setAllRecords(false)
    if (presetId === 'custom') return
    const [from, to] = presetToDates(presetId)
    setDateFrom(from ?? '')
    setDateTo(to ?? '')
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const canExport = (preview.exportCount ?? preview.count ?? 0) > 0 && !preview.loading

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      saveExportSession(reportKey, { datePreset, dateFrom, dateTo, allRecords, format, filters })
      await onExport(format, queryParams)
      onClose()
    } catch (err) {
      setExportError(err.message || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  const dateRangeLabel = formatDateRangeLabel(dateFrom, dateTo, allRecords)
  const previewCount = preview.exportCount ?? preview.count

  const inputStyle = {
    padding: '8px 10px',
    border: '1.5px solid var(--stroke)',
    borderRadius: 8,
    font: 'inherit',
    fontSize: '0.875rem',
    background: 'var(--surface)',
    width: '100%',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export report"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        className="dx-pop-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface, #fff)', borderRadius: 14, width: '100%', maxWidth: 520,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--stroke)' }}>
          <div>
            <strong style={{ fontSize: '0.95rem' }}>Export Report</strong>
            <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 2 }}>{reportTitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Date range
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: datePreset === p.id ? '1px solid #2563eb' : '1px solid var(--stroke)',
                    background: datePreset === p.id ? '#eff6ff' : '#fff',
                    color: datePreset === p.id ? '#1d4ed8' : 'inherit',
                    fontSize: '0.75rem',
                    fontWeight: datePreset === p.id ? 700 : 500,
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {(datePreset === 'custom' || (!allRecords && datePreset !== 'all')) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Date From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDatePreset('custom'); setAllRecords(false); setDateFrom(e.target.value) }}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Date To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDatePreset('custom'); setAllRecords(false); setDateTo(e.target.value) }}
                    style={inputStyle}
                  />
                </label>
              </div>
            )}
          </section>

          {filterFields.length > 0 && (
            <section>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Filters
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {filterFields.map((field) => (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {field.label}
                    {field.type === 'select' ? (
                      <select
                        value={filters[field.key] ?? field.defaultValue ?? ''}
                        onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        style={inputStyle}
                      >
                        {(field.options ?? []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={filters[field.key] ?? ''}
                        placeholder={field.placeholder}
                        onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          )}

          <section style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--stroke)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Export preview</div>
            {preview.loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--muted)' }}>
                <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Counting records…
              </div>
            ) : preview.error ? (
              <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.875rem' }}>{preview.error}</p>
            ) : previewCount > 0 ? (
              <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>
                {Number(previewCount).toLocaleString()} record{previewCount === 1 ? '' : 's'} will be exported.
                {preview.truncated && (
                  <span style={{ display: 'block', fontWeight: 500, fontSize: '0.75rem', color: '#b45309', marginTop: 4 }}>
                    Export is capped at 10,000 rows. Narrow your filters to include all matching records.
                  </span>
                )}
              </p>
            ) : (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>No data found for the selected filters.</p>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8 }}>
              Range: {preview.dateRange || dateRangeLabel}
            </div>
          </section>

          <section>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Format
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {formatOptions.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: format === fmt ? '1px solid #2563eb' : '1px solid var(--stroke)',
                    background: format === fmt ? '#eff6ff' : '#fff',
                    color: format === fmt ? '#1d4ed8' : 'inherit',
                    fontWeight: format === fmt ? 700 : 500,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </section>

          {exportError && (
            <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.8125rem' }}>{exportError}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--stroke)' }}>
          <button type="button" className="btn-dx-secondary" onClick={onClose} disabled={exporting}>Cancel</button>
          <button type="button" className="btn-dx-primary" onClick={handleExport} disabled={exporting || !canExport}>
            {exporting ? (
              <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Generating…</>
            ) : (
              <><Download size={15} /> Export {format.toUpperCase()}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportReportModal
