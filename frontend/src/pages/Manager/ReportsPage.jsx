import { useCallback, useEffect, useState } from 'react'
import { fetchAnalytics, fetchReports } from '../../api/manager'
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../../components/ui'
import { BarChart3, ClipboardList, Download, FileText, Users } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayName } from '../../utils/jobOrderHelpers'

function escapeCsv(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function downloadCsv(filename, headers, rows) {
  const csv = `\uFEFF${[headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n')}`
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: filename })
  a.click()
}

const TABS = [
  { key: 'deliveries', label: 'Deliveries', Icon: FileText, desc: 'Complete delivery history' },
  { key: 'driver_perf', label: 'Driver Performance', Icon: Users, desc: 'Driver efficiency metrics' },
]

function ReportsPage() {
  const [tab, setTab]         = useState('deliveries')
  const [deliveries, setDeliveries] = useState([])
  const [analytics, setAnalytics]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [page, setPage]       = useState(1)
  const [meta, setMeta]       = useState({ last_page: 1, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')

  const loadDeliveries = useCallback(async (p = 1, s = '') => {
    setLoading(true); setError('')
    try {
      const res = await fetchReports(p, s)
      setDeliveries(res.data || [])
      setMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try { setAnalytics(await fetchAnalytics()) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'deliveries') loadDeliveries(page, statusFilter)
    else loadAnalytics()
  }, [tab, page]) // eslint-disable-line

  const handleExport = () => {
    if (tab === 'deliveries') {
      downloadCsv(`deliveries-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Assignment', 'Client', 'Driver', 'Vehicle', 'Status', 'Assigned', 'Completed'],
        deliveries.map((d) => [
          d.id, buildDisplayName(d.job_order) || '—', d.driver?.user?.name ?? '—', d.vehicle?.plate_no ?? '—',
          d.status, d.assigned_at ? new Date(d.assigned_at).toLocaleString() : '—',
          d.completed_at ? new Date(d.completed_at).toLocaleString() : '—',
        ])
      )
    } else {
      const rows = analytics?.drivers ?? []
      downloadCsv(`driver-performance-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Driver', 'Total Jobs', 'Completed', 'On-Time Rate', 'Availability'],
        rows.map((d) => [d.name, d.total, d.completed, d.on_time_pct != null ? `${d.on_time_pct}%` : '—', d.availability])
      )
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate and export operational reports">
        <button type="button" className="btn-dx-primary" onClick={handleExport} disabled={loading}>
          <Download size={15} /> Export CSV
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}

      {/* Tab selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {TABS.map(({ key, label, Icon, desc }) => (
          <button key={key} type="button"
            className={`dx-report-tab${tab === key ? ' dx-report-tab--active' : ''}`}
            onClick={() => { setTab(key); setPage(1) }}
          >
            <span className="dx-report-tab-icon"><Icon size={20} /></span>
            <div className="dx-report-tab-copy"><strong>{label}</strong><span>{desc}</span></div>
          </button>
        ))}
      </div>

      <div className="dx-panel">
        {tab === 'deliveries' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
              Filter:
              <select value={statusFilter} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); loadDeliveries(1, e.target.value) }}>
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="assigned">Assigned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{meta.total} records</span>
          </div>
        )}

        {tab === 'deliveries' ? (
          <>
            <DataTable headers={['#', 'Client', 'Driver', 'Vehicle', 'Status', 'Assigned', 'Completed']} loading={loading}
              empty={<EmptyState icon={FileText} title="No deliveries found" />}
            >
              {deliveries.length > 0 && deliveries.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--muted)' }}>#{d.id}</td>
                  <td style={{ fontWeight: 600 }}>{buildDisplayName(d.job_order) || '—'}</td>
                  <td>{d.driver?.user?.name ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{d.vehicle?.plate_no ?? '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {d.assigned_at ? new Date(d.assigned_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {d.completed_at ? new Date(d.completed_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </DataTable>
            {meta.last_page > 1 && (
              <div className="dx-pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {page} / {meta.last_page}</span>
                <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        ) : (
          <DataTable headers={['Driver', 'Total Jobs', 'Completed', 'On-Time Rate', 'Availability']} loading={loading}
            empty={<EmptyState icon={Users} title="No driver data" />}
          >
            {(analytics?.drivers ?? []).map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td>{d.total}</td>
                <td>{d.completed}</td>
                <td>
                  {d.on_time_pct != null
                    ? <span style={{ fontWeight: 700, color: d.on_time_pct >= 90 ? 'var(--color-success)' : d.on_time_pct >= 75 ? 'var(--color-warning)' : 'var(--color-error)' }}>{d.on_time_pct}%</span>
                    : '—'}
                </td>
                <td><StatusBadge status={d.availability} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </>
  )
}

export default ReportsPage
