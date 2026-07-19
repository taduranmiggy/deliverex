import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAuditLogs } from '../../api/admin'
import AuditExportModal from '../../components/audit/AuditExportModal'
import { EmptyState, FilterSelect, LoadingRows, SearchInput } from '../../components/ui'
import { normalizeOcrModuleLabel } from '../../utils/displayLabels'
import { formatAuditAction, getAuditActionStyle } from '../../utils/audit/actionStyles'
import { parseDeviceLabel } from '../../utils/audit/parseDevice'
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ClipboardList, Download, Eye, RefreshCw, RotateCcw, X,
} from 'lucide-react'

const MODULES = [
  { value: 'all', label: 'All Modules' },
  { value: 'auth', label: 'Authentication' },
  { value: 'user', label: 'User Management' },
  { value: 'company', label: 'Companies' },
  { value: 'customer', label: 'Customer Management' },
  { value: 'job_order', label: 'Job Orders' },
  { value: 'dispatch', label: 'Fleet Dispatch' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'document', label: 'Documents' },
  { value: 'ocr', label: 'OCR Review' },
  { value: 'notification', label: 'Notifications' },
  { value: 'reports', label: 'Reports' },
  { value: 'settings', label: 'System Settings' },
  { value: 'driver', label: 'Drivers' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'inquiry', label: 'Support Inquiries' },
]

const PER_PAGE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_PER_PAGE = 25

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function LogDetailModal({ log, onClose }) {
  if (!log) return null
  const rows = [
    { label: 'Timestamp', value: log.timestamp ? new Date(log.timestamp).toLocaleString() : '—' },
    { label: 'User', value: log.user ?? '—' },
    { label: 'Role', value: log.role ?? '—' },
    { label: 'Action', value: log.action ?? '—' },
    { label: 'Module', value: normalizeOcrModuleLabel(log.module ?? '—') },
    { label: 'Description', value: log.description ?? log.details ?? '—' },
    { label: 'Status', value: String(log.status ?? 'success').toUpperCase() },
    { label: 'IP Address', value: log.ip_address ?? '—' },
    { label: 'Device', value: parseDeviceLabel(log.user_agent) },
    ...(log.user_agent ? [{ label: 'User Agent', value: log.user_agent }] : []),
  ]

  return (
    <div className="dx-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true">
      <div className="dx-modal dx-modal--md" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>Audit Log Details</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}>#{log.id}</p>
          </div>
          <button type="button" onClick={onClose} className="dx-icon-btn" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="dx-audit-detail-grid">
          {rows.map(({ label, value }) => (
            <div key={label} className="dx-audit-detail-grid__row">
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button type="button" className="btn-dx-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function PaginationBar({ page, totalPages, total, perPage, onPage, onPerPage }) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="dx-audit-pagination">
      <span className="dx-audit-pagination__summary">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} logs
      </span>
      <div className="dx-audit-pagination__controls">
        <button type="button" disabled={page <= 1} onClick={() => onPage(1)} aria-label="First"><ChevronsLeft size={15} /></button>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"><ChevronLeft size={15} /></button>
        {start > 1 && <span className="dx-audit-pagination__ellipsis">…</span>}
        {pages.map((p) => (
          <button key={p} type="button" className={p === page ? 'is-active' : ''} onClick={() => onPage(p)}>{p}</button>
        ))}
        {end < totalPages && <span className="dx-audit-pagination__ellipsis">…</span>}
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next"><ChevronRight size={15} /></button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(totalPages)} aria-label="Last"><ChevronsRight size={15} /></button>
      </div>
      <label className="dx-audit-pagination__perpage">
        Rows per page
        <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
          {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  )
}

function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [module, setModule] = useState('all')
  const [user, setUser] = useState('all')
  const [role, setRole] = useState('all')
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)
  const [lastPage, setLastPage] = useState(1)
  const [filterOptions, setFilterOptions] = useState({ modules: [], users: [], roles: [], actions: [] })
  const [selected, setSelected] = useState(null)
  const [showExport, setShowExport] = useState(false)

  const moduleOptions = useMemo(() => [
    { value: 'all', label: 'All Modules' },
    ...(filterOptions.modules.length ? filterOptions.modules : MODULES.slice(1)),
  ], [filterOptions.modules])
  const userOptions = useMemo(() => [{ value: 'all', label: 'All Users' }, ...filterOptions.users], [filterOptions.users])
  const roleOptions = useMemo(() => [{ value: 'all', label: 'All Roles' }, ...filterOptions.roles], [filterOptions.roles])
  const actionOptions = useMemo(() => [{ value: 'all', label: 'All Actions' }, ...filterOptions.actions], [filterOptions.actions])

  const currentFilters = useCallback((overrides = {}) => ({
    module: module !== 'all' ? module : undefined,
    user: user !== 'all' ? user : undefined,
    role: role !== 'all' ? role : undefined,
    action: action !== 'all' ? action : undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    sort,
    per_page: perPage,
    page,
    ...overrides,
  }), [module, user, role, action, from, to, search, sort, perPage, page])

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAuditLogs(params)
      setLogs(res.data || [])
      setTotal(res.total ?? 0)
      setLastPage(res.last_page ?? 1)
      if (res.filter_options) setFilterOptions(res.filter_options)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(currentFilters())
  }, []) // eslint-disable-line

  const handleFilter = () => {
    setPage(1)
    load(currentFilters({ page: 1 }))
  }

  const handleReset = () => {
    setModule('all')
    setUser('all')
    setRole('all')
    setAction('all')
    setFrom('')
    setTo('')
    setSearch('')
    setPage(1)
    load({ page: 1, per_page: perPage, sort })
  }

  const handleRefresh = () => load(currentFilters())

  const handleSort = (dir) => {
    setSort(dir)
    setPage(1)
    load(currentFilters({ page: 1, sort: dir }))
  }

  const handlePage = (next) => {
    setPage(next)
    load(currentFilters({ page: next }))
  }

  const handlePerPage = (next) => {
    setPerPage(next)
    setPage(1)
    load(currentFilters({ page: 1, per_page: next }))
  }

  const hasActiveFilters = module !== 'all' || user !== 'all' || role !== 'all' || action !== 'all' || from || to || search

  return (
    <div className="dx-audit-page">
      <header className="dx-audit-header">
        <div className="dx-audit-header__main">
          <div className="dx-audit-header__icon"><ClipboardList size={22} /></div>
          <div>
            <h1>Audit Logs</h1>
            <p>Complete history of system activities</p>
            <div className="dx-audit-header__meta">
              <span><strong>{total.toLocaleString()}</strong> total records</span>
              {lastUpdated && (
                <span>Last updated {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        </div>
        <div className="dx-audit-header__actions">
          <button type="button" className="btn-dx-secondary" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'dx-spin' : ''} /> Refresh
          </button>
          <button type="button" className="btn-dx-primary" onClick={() => setShowExport(true)}>
            <Download size={15} /> Export Report
          </button>
        </div>
      </header>

      {error && <p className="notice error">{error}</p>}

      <section className="dx-audit-filter-card">
        <div className="dx-audit-filter-card__title">Filters</div>
        <div className="dx-audit-filter-card__grid">
          <FilterSelect value={module} onChange={setModule} label="Module" options={moduleOptions} />
          <FilterSelect value={user} onChange={setUser} label="User" options={userOptions} />
          <FilterSelect value={role} onChange={setRole} label="Role" options={roleOptions} />
          <FilterSelect value={action} onChange={setAction} label="Action" options={actionOptions} />
          <label className="dx-audit-filter-field">
            Date From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFilter()} />
          </label>
          <label className="dx-audit-filter-field">
            Date To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFilter()} />
          </label>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search user, action, IP, details…"
            style={{ gridColumn: '1 / -1' }}
          />
        </div>
        <div className="dx-audit-filter-card__actions">
          <button type="button" className="btn-dx-primary" onClick={handleFilter} disabled={loading}>Apply Filters</button>
          {hasActiveFilters && (
            <button type="button" className="btn-dx-secondary" onClick={handleReset}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button type="button" className="btn-dx-secondary" onClick={() => setShowExport(true)}>
            <Download size={14} /> Export
          </button>
        </div>
      </section>

      <section className="dx-audit-table-panel">
        <div className="dx-audit-table-toolbar">
          <span>{loading ? 'Loading logs…' : `${total.toLocaleString()} matching records`}</span>
          <div className="dx-audit-table-toolbar__sort">
            <span>Sort</span>
            <button type="button" className={sort === 'desc' ? 'btn-dx-primary btn-sm' : 'btn-dx-secondary btn-sm'} onClick={() => handleSort('desc')}>
              <ArrowDown size={13} /> Newest
            </button>
            <button type="button" className={sort === 'asc' ? 'btn-dx-primary btn-sm' : 'btn-dx-secondary btn-sm'} onClick={() => handleSort('asc')}>
              <ArrowUp size={13} /> Oldest
            </button>
          </div>
        </div>

        <div className="dx-audit-table-wrap">
          <table className="dx-data-table dx-data-table--compact dx-audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Module</th>
                <th>Details</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={10} rows={Math.min(perPage, 10)} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      icon={ClipboardList}
                      title="No audit logs found"
                      message={hasActiveFilters ? 'No logs match the current filters.' : 'System activity will appear here as actions are performed.'}
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionStyle = getAuditActionStyle(log.action)
                  return (
                    <tr key={log.id} className="dx-audit-row">
                      <td className="dx-audit-cell--muted">{formatTs(log.timestamp)}</td>
                      <td>
                        <div className="dx-audit-user">{log.user ?? 'System'}</div>
                        {log.user_email && <div className="dx-audit-user__email">{log.user_email}</div>}
                      </td>
                      <td><span className="dx-audit-role">{log.role ?? '—'}</span></td>
                      <td>
                        <span
                          className="dx-audit-action-badge"
                          style={{ background: actionStyle.bg, color: actionStyle.color, borderColor: actionStyle.border }}
                          title={log.action}
                        >
                          {formatAuditAction(log.action)}
                        </span>
                      </td>
                      <td>{normalizeOcrModuleLabel(log.module)}</td>
                      <td className="dx-audit-cell--details" title={log.description ?? log.details}>
                        {log.description || log.details || '—'}
                      </td>
                      <td className="dx-audit-cell--mono">{log.ip_address ?? '—'}</td>
                      <td className="dx-audit-cell--device">{parseDeviceLabel(log.user_agent)}</td>
                      <td>
                        <span className={`dx-audit-status dx-audit-status--${log.status === 'failed' ? 'failed' : 'success'}`}>
                          {log.status ?? 'success'}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="dx-audit-view-btn" onClick={() => setSelected(log)} aria-label="View details">
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <PaginationBar
            page={Math.min(page, lastPage)}
            totalPages={Math.max(1, lastPage)}
            total={total}
            perPage={perPage}
            onPage={handlePage}
            onPerPage={handlePerPage}
          />
        )}
      </section>

      {selected && <LogDetailModal log={selected} onClose={() => setSelected(null)} />}

      <AuditExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        initialFilters={currentFilters()}
        userOptions={userOptions}
      />
    </div>
  )
}

export default AdminAuditLogsPage
