import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, Eye, FileSpreadsheet, FileText, FolderOpen, Loader2, X } from 'lucide-react'
import { exportAuditLogs } from '../api/admin'
import { fetchExportPreview } from '../api/export'
import { presetToDates } from '../utils/export/exportDatePresets'
import { loadExportSession, saveExportSession } from '../utils/export/exportSession'
import {
  AUDIT_ACTION_CATEGORIES,
  AUDIT_EXPORT_MODULES,
  AUDIT_EXPORT_ROLES,
  AUDIT_INCLUDE_OPTIONS,
  EXPORT_PROGRESS_STEPS,
} from '../utils/audit/exportConfig'

const DATE_QUICK = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
  { id: 'all', label: 'All Records' },
]

function defaultIncludeOptions() {
  return Object.fromEntries(AUDIT_INCLUDE_OPTIONS.map((o) => [o.key, o.default]))
}

function AuditExportModal({ open, onClose, initialFilters = {}, userOptions = [] }) {
  const [format, setFormat] = useState('pdf')
  const [datePreset, setDatePreset] = useState('last_30_days')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [allRecords, setAllRecords] = useState(false)
  const [modules, setModules] = useState([])
  const [actionCategories, setActionCategories] = useState([])
  const [user, setUser] = useState('all')
  const [role, setRole] = useState('all')
  const [includeOptions, setIncludeOptions] = useState(defaultIncludeOptions)
  const [preview, setPreview] = useState({ count: null, loading: false, error: '', truncated: false })
  const [phase, setPhase] = useState('form')
  const [progressStep, setProgressStep] = useState(0)
  const [exportResult, setExportResult] = useState(null)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    if (!open) return
    const session = loadExportSession('audit_logs') ?? {}
    const preset = session.datePreset ?? 'last_30_days'
    const [from, to] = presetToDates(preset)
    setFormat(session.format ?? 'pdf')
    setDatePreset(preset)
    setDateFrom(session.dateFrom ?? from ?? '')
    setDateTo(session.dateTo ?? to ?? '')
    setAllRecords(session.allRecords ?? preset === 'all')
    setModules(session.modules ?? [])
    setActionCategories(session.actionCategories ?? [])
    setUser(session.user ?? initialFilters.user ?? 'all')
    setRole(session.role ?? initialFilters.role ?? 'all')
    setIncludeOptions({ ...defaultIncludeOptions(), ...(session.includeOptions ?? {}) })
    setPhase('form')
    setExportResult(null)
    setExportError('')
    setProgressStep(0)
  }, [open, initialFilters.user, initialFilters.role])

  const queryParams = useMemo(() => {
    const params = {
      ...includeOptions,
      sort: initialFilters.sort ?? 'desc',
    }
    if (allRecords || datePreset === 'all') {
      params.all_records = true
      params.date_preset = 'all'
    } else {
      params.date_preset = datePreset !== 'custom' ? datePreset : undefined
      params.from = dateFrom || undefined
      params.to = dateTo || undefined
    }
    if (modules.length) params.modules = modules
    else if (initialFilters.module) params.module = initialFilters.module
    if (actionCategories.length) params.action_categories = actionCategories
    if (user !== 'all') params.user = user
    if (role !== 'all') params.role = role
    if (initialFilters.search) params.search = initialFilters.search
    return params
  }, [allRecords, datePreset, dateFrom, dateTo, modules, actionCategories, user, role, includeOptions, initialFilters])

  const loadPreview = useCallback(async () => {
    if (!open) return
    setPreview((p) => ({ ...p, loading: true, error: '' }))
    try {
      const res = await fetchExportPreview('audit_logs', queryParams)
      setPreview({
        count: res.export_count ?? res.count ?? 0,
        loading: false,
        error: '',
        truncated: Boolean(res.truncated),
        dateRange: res.date_range,
      })
    } catch (err) {
      setPreview({ count: 0, loading: false, error: err.message || 'Preview failed.', truncated: false })
    }
  }, [open, queryParams])

  useEffect(() => {
    if (!open || phase !== 'form') return undefined
    const timer = setTimeout(loadPreview, 350)
    return () => clearTimeout(timer)
  }, [open, phase, loadPreview])

  const toggleModule = (key) => {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]))
  }

  const toggleAction = (key) => {
    setActionCategories((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]))
  }

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

  const runExport = async (exportFormat = format) => {
    setPhase('progress')
    setExportError('')
    setProgressStep(0)
    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, EXPORT_PROGRESS_STEPS.length - 1)
      setProgressStep(step)
    }, 700)

    try {
      saveExportSession('audit_logs', {
        format: exportFormat,
        datePreset,
        dateFrom,
        dateTo,
        allRecords,
        modules,
        actionCategories,
        user,
        role,
        includeOptions,
        filters: queryParams,
      })
      const result = await exportAuditLogs(exportFormat, queryParams)
      clearInterval(interval)
      setProgressStep(EXPORT_PROGRESS_STEPS.length - 1)
      setExportResult(result)
      setPhase('success')
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      clearInterval(interval)
      setExportError(err.message || 'Export failed.')
      setPhase('form')
    }
  }

  const downloadAgain = () => {
    if (!exportResult?.blob) return
    const url = URL.createObjectURL(exportResult.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportResult.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  const previewCount = preview.count ?? 0
  const canExport = previewCount > 0 && !preview.loading

  return (
    <div className="dx-audit-export-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Export audit report">
      <div className="dx-audit-export-modal dx-pop-in" onClick={(e) => e.stopPropagation()}>
        {phase === 'form' && (
          <>
            <header className="dx-audit-export-modal__header">
              <div>
                <h2>Export Audit Report</h2>
                <p>Choose what data you want to export.</p>
              </div>
              <button type="button" className="dx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </header>

            <div className="dx-audit-export-modal__body">
              <section className="dx-audit-export-section">
                <h3>Export Format</h3>
                <div className="dx-audit-export-format">
                  {[
                    { id: 'pdf', label: 'PDF (Recommended)', Icon: FileText },
                    { id: 'xlsx', label: 'Excel (.xlsx)', Icon: FileSpreadsheet },
                    { id: 'csv', label: 'CSV', Icon: FileText },
                  ].map(({ id, label, Icon }) => (
                    <label key={id} className={`dx-audit-export-format__option${format === id ? ' is-active' : ''}`}>
                      <input type="radio" name="audit-export-format" value={id} checked={format === id} onChange={() => setFormat(id)} />
                      <Icon size={16} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="dx-audit-export-section">
                <h3>Date Range</h3>
                <div className="dx-audit-export-chips">
                  {DATE_QUICK.map((p) => (
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

              <section className="dx-audit-export-section">
                <div className="dx-audit-export-section__head">
                  <h3>Modules</h3>
                  <button type="button" className="dx-link-btn" onClick={() => setModules(AUDIT_EXPORT_MODULES.map((m) => m.key))}>Select All</button>
                </div>
                <div className="dx-audit-export-checkgrid">
                  {AUDIT_EXPORT_MODULES.map((m) => (
                    <label key={m.key}><input type="checkbox" checked={modules.includes(m.key)} onChange={() => toggleModule(m.key)} /> {m.label}</label>
                  ))}
                </div>
              </section>

              <section className="dx-audit-export-section">
                <h3>Actions</h3>
                <div className="dx-audit-export-checkgrid">
                  {AUDIT_ACTION_CATEGORIES.map((a) => (
                    <label key={a.key}><input type="checkbox" checked={actionCategories.includes(a.key)} onChange={() => toggleAction(a.key)} /> {a.label}</label>
                  ))}
                </div>
              </section>

              <section className="dx-audit-export-section dx-audit-export-section--grid2">
                <label>Users
                  <select value={user} onChange={(e) => setUser(e.target.value)}>
                    <option value="all">All Users</option>
                    {userOptions.filter((u) => u.value !== 'all').map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </label>
                <label>Roles
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    {AUDIT_EXPORT_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="dx-audit-export-section">
                <h3>Include Options</h3>
                <div className="dx-audit-export-checkgrid">
                  {AUDIT_INCLUDE_OPTIONS.map((o) => (
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
                {preview.truncated && <small>Export capped at 10,000 rows. Narrow filters to include all matches.</small>}
              </section>

              {exportError && <p className="notice error">{exportError}</p>}
            </div>

            <footer className="dx-audit-export-modal__footer">
              <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-dx-secondary" onClick={loadPreview} disabled={preview.loading}>
                <Eye size={15} /> Preview Report
              </button>
              <button type="button" className="btn-dx-secondary" onClick={() => runExport('csv')} disabled={!canExport}>
                Export CSV
              </button>
              <button type="button" className="btn-dx-primary" onClick={() => runExport('pdf')} disabled={!canExport}>
                <Download size={15} /> Export PDF
              </button>
              <button type="button" className="btn-dx-primary" onClick={() => runExport('xlsx')} disabled={!canExport}>
                <FileSpreadsheet size={15} /> Export Excel
              </button>
            </footer>
          </>
        )}

        {phase === 'progress' && (
          <div className="dx-audit-export-progress">
            <Loader2 size={42} className="dx-spin" />
            <h3>{EXPORT_PROGRESS_STEPS[progressStep]}</h3>
            <p>Please wait while your report is being generated.</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="dx-audit-export-success">
            <CheckCircle2 size={48} className="dx-audit-export-success__icon" />
            <h3>Report exported successfully.</h3>
            <p>{exportResult?.filename}</p>
            <div className="dx-audit-export-success__actions">
              <button type="button" className="btn-dx-secondary" onClick={downloadAgain}><Download size={15} /> Download Again</button>
              <button type="button" className="btn-dx-secondary" onClick={onClose}><FolderOpen size={15} /> Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditExportModal
