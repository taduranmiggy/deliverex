import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAuditLogs, exportAuditLogs } from '../../api/admin'
import ExportReportModal from '../../components/ExportReportModal'
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
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'user',      label: 'User Management' },
  { value: 'company',   label: 'Companies' },
  { value: 'customer',  label: 'Customer Management' },
  { value: 'job_order', label: 'Job Orders' },
  { value: 'dispatch',  label: 'Dispatch' },
  { value: 'calendar',  label: 'Calendar' },
  { value: 'tracking',  label: 'Tracking' },
  { value: 'delivery',  label: 'Delivery' },
  { value: 'document',  label: 'Documents' },
  { value: 'ocr',       label: 'OCR' },
  { value: 'gps',       label: 'GPS' },
  { value: 'offline',   label: 'Offline Sync' },
  { value: 'reports',   label: 'Reports' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'email',     label: 'Email Monitoring' },
  { value: 'notification', label: 'Notifications' },
  { value: 'support',   label: 'Support / Chatbox' },
  { value: 'settings',  label: 'Settings' },
  { value: 'profile',   label: 'Profile Management' },
  { value: 'driver',    label: 'Driver Management' },
  { value: 'vehicle',   label: 'Vehicle Management' },
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
    { label: 'Status',     value: String(log.status ?? 'success').toUpperCase() },
    { label: 'Record ID',  value: log.subject_id ?? '—' },
    { label: 'IP Address', value: log.ip_address ?? '—' },
    { label: 'Description', value: log.description ?? log.details ?? '—' },
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
  const [user, setUser]         = useState('all')
  const [role, setRole]         = useState('all')
  const [action, setAction]     = useState('all')
  const [search, setSearch]     = useState('')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [sort, setSort]         = useState('desc')
  const [page, setPage]         = useState(1)
  const [perPage]   = useState(PER_PAGE)
  const [lastPage, setLastPage] = useState(1)
  const [filterOptions, setFilterOptions] = useState({ modules: [], users: [], roles: [], actions: [] })
  const [selected, setSelected] = useState(null)
  const [showExportSummary, setShowExportSummary] = useState(false)

  const moduleOptions = useMemo(() => [
    { value: 'all', label: 'All Modules' },
    ...(filterOptions.modules.length ? filterOptions.modules : MODULES.slice(1)),
  ], [filterOptions.modules])
  const userOptions = useMemo(() => [{ value: 'all', label: 'All Users' }, ...filterOptions.users], [filterOptions.users])
  const roleOptions = useMemo(() => [{ value: 'all', label: 'All Roles' }, ...filterOptions.roles], [filterOptions.roles])
  const actionOptions = useMemo(() => [{ value: 'all', label: 'All Actions' }, ...filterOptions.actions], [filterOptions.actions])

  const auditExportFilterFields = useMemo(() => [
    { key: 'module', label: 'Module', type: 'select', defaultValue: module, options: moduleOptions },
    { key: 'user', label: 'User', type: 'select', defaultValue: user, options: userOptions },
    { key: 'role', label: 'Role', type: 'select', defaultValue: role, options: roleOptions },
    { key: 'action', label: 'Action', type: 'select', defaultValue: action, options: actionOptions },
    { key: 'search', label: 'Search', type: 'text', placeholder: 'User, action, IP…' },
  ], [action, actionOptions, module, moduleOptions, role, roleOptions, user, userOptions])

  const auditInitialFilters = useMemo(() => ({
    module: module !== 'all' ? module : undefined,
    user: user !== 'all' ? user : undefined,
    role: role !== 'all' ? role : undefined,
    action: action !== 'all' ? action : undefined,
    search: search || undefined,
    sort,
  }), [action, module, role, search, sort, user])

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAuditLogs(params)
      setLogs(res.data || [])
      setTotal(res.total ?? res.data?.length ?? 0)
      setLastPage(res.last_page ?? 1)
      if (res.filter_options) setFilterOptions(res.filter_options)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => load({ page: 1, per_page: perPage, sort }), 0)
    return () => window.clearTimeout(timer)
  }, []) // eslint-disable-line

  const currentFilters = (overrides = {}) => ({
    module: module !== 'all' ? module : undefined,
    user: user !== 'all' ? user : undefined,
    role: role !== 'all' ? role : undefined,
    action: action !== 'all' ? action : undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    sort,
    per_page: perPage,
    ...overrides,
  })

  const handleFilter = () => {
    setPage(1)
    load(currentFilters({ page: 1 }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleFilter()
  }

  const totalPages = Math.max(1, lastPage)
  const safePage = Math.min(page, totalPages)
  const pageLogs = logs
  const fromCount = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const toCount = Math.min(safePage * perPage, total)

  const handleSort = (dir) => {
    setSort(dir)
    setPage(1)
    load(currentFilters({ page: 1, sort: dir }))
  }

  const handlePage = (nextPage) => {
    setPage(nextPage)
    load(currentFilters({ page: nextPage }))
  }

  const handleExport = async (format, filters) => {
    const { blob, filename } = await exportAuditLogs(format, filters)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
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
        >
          <Download size={15} /> Export
        </button>
      </PageHeader>

      {error && <p className="notice error">{error}</p>}

      {/* ── Filters ── */}
      <div className="dx-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <FilterSelect value={module} onChange={setModule} label="Module" options={moduleOptions} />
          <FilterSelect value={user} onChange={setUser} label="User" options={userOptions} />
          <FilterSelect value={role} onChange={setRole} label="Role" options={roleOptions} />
          <FilterSelect value={action} onChange={setAction} label="Action" options={actionOptions} />
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
            {(module !== 'all' || user !== 'all' || role !== 'all' || action !== 'all' || from || to || search) && (
              <button
                type="button"
                className="btn-dx-secondary"
                onClick={() => {
                  setModule('all'); setUser('all'); setRole('all'); setAction('all')
                  setFrom(''); setTo(''); setSearch(''); setPage(1)
                  load({ page: 1, per_page: perPage, sort })
                }}
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
            {loading ? 'Loading logs…' : logs.length === 0
              ? 'No logs found'
              : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${total.toLocaleString()} logs`}
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
                <th>Description</th>
                <th style={{ minWidth: 80 }}>Record ID</th>
                <th style={{ minWidth: 90 }}>Status</th>
                <th style={{ minWidth: 110 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={8} rows={perPage > 10 ? 10 : perPage} />
              ) : pageLogs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={ClipboardList}
                      title="No audit logs found"
                      message={search || from || to || module !== 'all' || user !== 'all' || role !== 'all' || action !== 'all'
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
                      {log.role && <div style={{ color: 'var(--muted)', fontSize: '0.7rem', textTransform: 'capitalize' }}>{log.role}</div>}
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
                      title={log.description ?? log.details}>
                      {log.description || log.details || '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {log.subject_id ?? '—'}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                        color: log.status === 'failed' ? '#b91c1c' : '#166534',
                        background: log.status === 'failed' ? '#fef2f2' : '#f0fdf4',
                      }}>
                        {log.status ?? 'success'}
                      </span>
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
        {!loading && total > perPage && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPage={handlePage}
          />
        )}
        {!loading && total > 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 10 }}>
            Page {safePage} of {totalPages}
          </p>
        )}
      </div>

      {selected && (
        <LogDetailModal log={selected} onClose={() => setSelected(null)} />
      )}

      <ExportReportModal
        open={showExportSummary}
        onClose={() => setShowExportSummary(false)}
        reportKey="audit_logs"
        reportTitle="Audit Logs"
        onExport={handleExport}
        initialFilters={auditInitialFilters}
        filterFields={auditExportFilterFields}
        formatOptions={['pdf', 'xlsx', 'csv']}
        defaultFormat="pdf"
      />
    </>
  )
}

export default AdminAuditLogsPage
