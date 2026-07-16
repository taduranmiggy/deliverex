import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAuditLogs, exportAuditLogs } from '../../api/admin'
import ExportConfirmModal from '../../components/ExportConfirmModal'
import { EmptyState, FilterSelect, LoadingRows, PageHeader, SearchInput } from '../../components/ui'
import { normalizeOcrModuleLabel } from '../../utils/displayLabels'
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ClipboardList,
  ChevronsLeft, ChevronsRight, Download, X,
} from 'lucide-react'

/* ── Constants ──────────────────────────────────────────────── */
const MODULES = [
  { value: 'all',       label: 'All Modules' },
  { value: 'auth',      label: 'Auth' },
  { value: 'user',      label: 'User Management' },
  { value: 'company',   label: 'Companies' },
  { value: 'job_order', label: 'Job Orders' },
  { value: 'dispatch',  label: 'Dispatch' },
  { value: 'delivery',  label: 'Delivery' },
  { value: 'document',  label: 'Documents' },
  { value: 'ocr',       label: 'OCR' },
  { value: 'gps',       label: 'GPS' },
  { value: 'offline',   label: 'Offline Sync' },
  { value: 'reports',   label: 'Reports' },
  { value: 'settings',  label: 'Settings' },
  { value: 'inquiry',   label: 'Inquiries' },
]

const MODULE_COLORS = {
  Auth:           '#0891b2',
  'Job Orders':   '#2563eb',
  Dispatch:       '#d97706',
  Delivery:       '#16a34a',
  'OCR Review':     '#7c3aed',
  'OCR Validation': '#7c3aed',
  Inquiries:      '#ea580c',
  System:         '#64748b',
  'User Management': '#0f766e',
  'Company Management': '#0369a1',
  Documents:      '#9333ea',
  GPS:            '#059669',
  'Offline Sync': '#b45309',
  Reports:        '#4f46e5',
  Settings:       '#57534e',
}

const PER_PAGE = 6

/* ── Helpers ────────────────────────────────────────────────── */
/** Convert "auth.login_success" → "Login Success" */
function formatAction(raw) {
  if (!raw) return '—'
  const parts = String(raw).split('.')
  const last = parts[parts.length - 1]
  return last.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

/* ── Detail Modal ───────────────────────────────────────────── */
function LogDetailModal({ log, onClose }) {
  if (!log) return null

  const rows = [
    { label: 'Timestamp',  value: log.timestamp ? new Date(log.timestamp).toLocaleString() : '—' },
    { label: 'User',       value: log.user ?? '—' },
    { label: 'Email',      value: log.user_email ?? '—' },
    { label: 'Role',       value: log.role ?? '—' },
    { label: 'Action',     value: log.action ?? '—' },
    { label: 'Readable',   value: formatAction(log.action) },
    { label: 'Module',     value: normalizeOcrModuleLabel(log.module ?? '—') },
    { label: 'IP Address', value: log.ip_address ?? '—' },
    { label: 'Details',    value: log.details ?? '—' },
    ...(log.changes && Object.keys(log.changes).length > 0
      ? [{ label: 'Changes', value: log.details ?? JSON.stringify(log.changes, null, 2) }]
      : []),
    ...(log.user_agent ? [{ label: 'User Agent', value: log.user_agent }] : []),
    ...(log.session_id ? [{ label: 'Session', value: log.session_id }] : []),
  ]

  return (
    <div
      className="dx-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Audit Log Details"
    >
      <div className="dx-modal dx-modal--md" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>Audit Log Details</h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              #{log.id ?? '—'} · {normalizeOcrModuleLabel(log.module)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="dx-icon-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Detail rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--stroke)' }}>
          {rows.map(({ label, value }, i) => (
            <div key={label} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12,
              padding: '10px 14px',
              background: i % 2 === 0 ? 'var(--slate-50)' : '#fff',
              borderBottom: i < rows.length - 1 ? '1px solid var(--stroke)' : 'none',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', alignSelf: 'start', paddingTop: 2 }}>
                {label}
              </span>
              <span style={{
                fontSize: '0.875rem',
                color: label === 'Action' ? 'var(--text)' : 'var(--text)',
                fontFamily: label === 'Action' || label === 'IP Address' ? 'monospace' : 'inherit',
                wordBreak: 'break-word',
              }}>
                {label === 'Action'
                  ? <code style={{ background: 'var(--slate-100)', padding: '1px 7px', borderRadius: 5, fontSize: '0.8125rem' }}>{value}</code>
                  : value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-dx-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Pagination Controls ─────────────────────────────────────── */
function Pagination({ page, totalPages, onPage }) {
  const pages = []
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 34, height: 34, border: '1.5px solid var(--stroke)', borderRadius: 8,
    background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8125rem',
    fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
    padding: '0 8px',
  }
  const btnDisabled = { ...btnBase, opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }
  const btnActive   = { ...btnBase, background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)', fontWeight: 700 }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', paddingTop: 16, flexWrap: 'wrap' }}>
      <button type="button" style={page <= 1 ? btnDisabled : btnBase} onClick={() => onPage(1)} title="First page">
        <ChevronsLeft size={15} />
      </button>
      <button type="button" style={page <= 1 ? btnDisabled : btnBase} onClick={() => onPage(page - 1)} title="Previous page">
        <ChevronLeft size={15} />
      </button>

      {start > 1 && <span style={{ color: 'var(--muted)', padding: '0 4px' }}>…</span>}
      {pages.map((p) => (
        <button key={p} type="button" style={p === page ? btnActive : btnBase} onClick={() => onPage(p)}>
          {p}
        </button>
      ))}
      {end < totalPages && <span style={{ color: 'var(--muted)', padding: '0 4px' }}>…</span>}

      <button type="button" style={page >= totalPages ? btnDisabled : btnBase} onClick={() => onPage(page + 1)} title="Next page">
        <ChevronRight size={15} />
      </button>
      <button type="button" style={page >= totalPages ? btnDisabled : btnBase} onClick={() => onPage(totalPages)} title="Last page">
        <ChevronsRight size={15} />
      </button>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────── */
function AdminAuditLogsPage() {
  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [module, setModule]     = useState('all')
  const [search, setSearch]     = useState('')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [sort, setSort]         = useState('desc')
  const [page, setPage]         = useState(1)
  const [perPage]   = useState(PER_PAGE)
  const [selected, setSelected] = useState(null)
  const [showExportSummary, setShowExportSummary] = useState(false)
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAuditLogs(params)
      setLogs(res.data || [])
      setTotal(res.total ?? res.data?.length ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ module: module !== 'all' ? module : undefined })
  }, []) // eslint-disable-line

  const handleFilter = () => {
    setPage(1)
    load({
      module: module !== 'all' ? module : undefined,
      from:   from   || undefined,
      to:     to     || undefined,
      search: search || undefined,
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleFilter()
  }

  /* Client-side sort + paginate */
  const sorted = useMemo(() => (
    [...logs].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return sort === 'desc' ? tb - ta : ta - tb
    })
  ), [logs, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const pageLogs   = sorted.slice((safePage - 1) * perPage, safePage * perPage)
  const fromCount  = sorted.length === 0 ? 0 : (safePage - 1) * perPage + 1
  const toCount    = Math.min(safePage * perPage, sorted.length)

  const handleSort = (dir) => { setSort(dir); setPage(1) }

  const exportSummary = useMemo(() => {
    const moduleLabel = MODULES.find((m) => m.value === module)?.label ?? 'All Modules'
    const parts = [moduleLabel]
    if (from) parts.push(`From ${from}`)
    if (to) parts.push(`To ${to}`)
    if (search) parts.push(`Search: “${search}”`)
    return {
      report: 'Audit Logs',
      dateRange: from && to ? `${from} – ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All records',
      filters: parts.join(' · '),
      rows: logs.length,
      total,
    }
  }, [module, from, to, search, logs.length, total])

  const exportFilters = useMemo(() => ({
    module: module !== 'all' ? module : undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    sort,
  }), [module, from, to, search, sort])

  const handleConfirmExport = async () => {
    setExporting(true)
    try {
      const { blob, filename } = await exportAuditLogs(exportFormat, exportFilters)
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      a.click()
      URL.revokeObjectURL(url)
      setShowExportSummary(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  /* Input style reuse */
  const inputStyle = {
    padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10,
    font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)',
  }

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle={`Complete history of system activities${total > 0 ? ` · ${total.toLocaleString()} entries` : ''}`}
      >
        <button
          type="button"
          className="btn-dx-secondary"
          onClick={() => setShowExportSummary(true)}
          disabled={total === 0 && logs.length === 0}
        >
          <Download size={15} /> Export
        </button>
      </PageHeader>

      {error && <p className="notice error">{error}</p>}

      {/* ── Filters ── */}
      <div className="dx-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <FilterSelect value={module} onChange={setModule} label="Module" options={MODULES} />
          <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} onKeyDown={handleKeyDown} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} onKeyDown={handleKeyDown} />
          </label>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search user, action, details…"
            style={{ flex: 1, minWidth: 200, maxWidth: 280 }}
          />
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
            <button type="button" className="btn-dx-primary" onClick={handleFilter} disabled={loading}>
              {loading ? 'Loading…' : 'Apply Filters'}
            </button>
            {(module !== 'all' || from || to || search) && (
              <button
                type="button"
                className="btn-dx-secondary"
                onClick={() => { setModule('all'); setFrom(''); setTo(''); setSearch(''); setPage(1); load({}) }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Panel ── */}
      <div className="dx-panel">
        {/* Table toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>
            {loading ? 'Loading logs…' : sorted.length === 0
              ? 'No logs found'
              : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${sorted.length.toLocaleString()} logs`}
          </span>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Sort controls */}
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600 }}>Sort:</span>
            <button
              type="button"
              className={sort === 'desc' ? 'btn-dx-primary btn-sm' : 'btn-dx-secondary btn-sm'}
              onClick={() => handleSort('desc')}
              title="Newest first"
            >
              <ArrowDown size={13} /> Newest
            </button>
            <button
              type="button"
              className={sort === 'asc' ? 'btn-dx-primary btn-sm' : 'btn-dx-secondary btn-sm'}
              onClick={() => handleSort('asc')}
              title="Oldest first"
            >
              <ArrowUp size={13} /> Oldest
            </button>

          </div>
        </div>

        {/* Scrollable table with sticky header */}
        <div className="dx-audit-table-wrap">
          <table className="dx-data-table dx-data-table--compact dx-audit-table">
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>Timestamp</th>
                <th style={{ minWidth: 150 }}>User</th>
                <th style={{ minWidth: 140 }}>Action</th>
                <th style={{ minWidth: 120 }}>Module</th>
                <th>Details</th>
                <th style={{ minWidth: 110 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={6} rows={perPage > 10 ? 10 : perPage} />
              ) : pageLogs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ClipboardList}
                      title="No audit logs found"
                      message={search || from || to || module !== 'all'
                        ? 'No logs match the current filters. Try adjusting your search.'
                        : 'System activity will appear here as actions are performed.'}
                    />
                  </td>
                </tr>
              ) : (
                pageLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="dx-audit-row"
                    onClick={() => setSelected(log)}
                    title="Click to view full details"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(log) }}
                    role="button"
                    aria-label={`Audit log: ${formatAction(log.action)} by ${log.user}`}
                  >
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {formatTs(log.timestamp)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.3 }}>{log.user ?? '—'}</div>
                      {log.user_email && (
                        <div style={{ color: 'var(--muted)', fontSize: '0.75rem', lineHeight: 1.3 }}>
                          {log.user_email}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}
                        title={log.action}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '2px 9px', borderRadius: 99,
                        background: 'var(--slate-100)', fontSize: '0.75rem', fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: MODULE_COLORS[normalizeOcrModuleLabel(log.module)] ?? MODULE_COLORS[log.module] ?? 'var(--muted)',
                        }} />
                        {normalizeOcrModuleLabel(log.module)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={log.details}>
                      {log.details || '—'}
                    </td>
                    <td style={{ color: 'var(--subtle)', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!loading && sorted.length > perPage && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPage={setPage}
          />
        )}
        {!loading && sorted.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 10 }}>
            Page {safePage} of {totalPages}
          </p>
        )}
      </div>

      {selected && (
        <LogDetailModal log={selected} onClose={() => setSelected(null)} />
      )}

      <ExportConfirmModal
        open={showExportSummary}
        onClose={() => setShowExportSummary(false)}
        onConfirm={handleConfirmExport}
        reportName={exportSummary.report}
        dateRange={exportSummary.dateRange}
        filters={exportSummary.filters}
        rows={exportSummary.total || exportSummary.rows}
        total={exportSummary.total}
        confirming={exporting}
        formatValue={exportFormat}
        onFormatChange={setExportFormat}
        formatOptions={['csv', 'xlsx', 'pdf']}
        infoNotice="Server export includes all matching audit records (up to 10,000 rows) with Deliverex report branding."
        confirmLabel={`Download ${exportFormat.toUpperCase()}`}
      />
    </>
  )
}

export default AdminAuditLogsPage
