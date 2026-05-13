import { useCallback, useEffect, useState } from 'react'
import { fetchAuditLogs } from '../../api/admin'
import { DataTable, EmptyState, FilterSelect, PageHeader, SearchInput } from '../../components/ui'
import { ClipboardList, Download } from 'lucide-react'

const MODULES = [
  { value: 'all', label: 'All Modules' }, { value: 'auth', label: 'Auth' },
  { value: 'job_order', label: 'Job Orders' }, { value: 'dispatch', label: 'Dispatch' },
  { value: 'delivery', label: 'Delivery' }, { value: 'ocr', label: 'OCR Validation' },
  { value: 'inquiry', label: 'Inquiries' },
]

function escapeCsv(v) { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function downloadCsv(rows) {
  const headers = ['Timestamp', 'User', 'Email', 'Action', 'Module', 'Details', 'IP']
  const lines = rows.map((r) => [r.timestamp ? new Date(r.timestamp).toLocaleString() : '—', r.user, r.user_email ?? '', r.action, r.module, r.details, r.ip_address ?? ''].map(escapeCsv).join(','))
  const csv = `\uFEFF${[headers.join(','), ...lines].join('\r\n')}`
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
}

const MODULE_DOT_COLORS = { Auth: '#0891b2', 'Job Orders': '#2563eb', Dispatch: '#d97706', Delivery: '#16a34a', 'OCR Validation': '#7c3aed', Inquiries: '#ea580c', System: '#64748b' }

function AdminAuditLogsPage() {
  const [logs, setLogs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [module, setModule]   = useState('all')
  const [search, setSearch]   = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')

  const load = useCallback(async (params = {}) => {
    setLoading(true); setError('')
    try {
      const res = await fetchAuditLogs(params)
      setLogs(res.data || [])
      setTotal(res.total ?? res.data?.length ?? 0)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load({ module: module !== 'all' ? module : undefined }) }, []) // eslint-disable-line

  const handleFilter = () => load({ module: module !== 'all' ? module : undefined, from: from || undefined, to: to || undefined, search: search || undefined })

  return (
    <>
      <PageHeader title="Audit Logs" subtitle={`Complete history of system activities${total > 0 ? ` · ${total} entries` : ''}`}>
        <button type="button" className="btn-dx-secondary" onClick={() => downloadCsv(logs)} disabled={logs.length === 0}>
          <Download size={15} /> Export CSV
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <FilterSelect value={module} onChange={setModule} label="Module" options={MODULES} />
        <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem' }}>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }} />
        </label>
        <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem' }}>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }} />
        </label>
        <SearchInput value={search} onChange={setSearch} placeholder="Search action or user…" style={{ flex: 1, maxWidth: 260 }} />
        <button type="button" className="btn-dx-primary" onClick={handleFilter} disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? 'Loading…' : 'Apply Filters'}
        </button>
      </div>

      <div className="dx-panel">
        <DataTable
          headers={['Timestamp', 'User', 'Action', 'Module', 'Details', 'IP']}
          loading={loading}
          empty={<EmptyState icon={ClipboardList} title="No audit logs" message="System activity will appear here as actions are performed." />}
        >
          {logs.length > 0 && logs.map((log) => (
            <tr key={log.id}>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
              </td>
              <td>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 1 }}>{log.user}</p>
                  {log.user_email && <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{log.user_email}</p>}
                </div>
              </td>
              <td><code style={{ fontSize: '0.8125rem', background: 'var(--slate-100)', padding: '2px 7px', borderRadius: 5 }}>{log.action}</code></td>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: 'var(--slate-100)', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: MODULE_DOT_COLORS[log.module] ?? 'var(--muted)', flexShrink: 0 }} />
                  {log.module}
                </span>
              </td>
              <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{log.details}</td>
              <td style={{ color: 'var(--subtle)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{log.ip_address ?? '—'}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </>
  )
}

export default AdminAuditLogsPage
