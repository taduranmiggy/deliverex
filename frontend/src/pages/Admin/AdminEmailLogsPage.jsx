import { useCallback, useEffect, useState } from 'react'
import { fetchEmailLogStats, fetchEmailLogs, fetchEmailLogTypes, retryEmailLog } from '../../api/admin'
import { DataTable, EmptyState, FilterSelect, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import { Mail, RefreshCw } from 'lucide-react'

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

function AdminEmailLogsPage() {
  const [logs, setLogs] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, per_page: 6, total: 0 })
  const [stats, setStats] = useState({ pending: 0, sent: 0, delivered: 0, failed: 0 })
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [emailType, setEmailType] = useState('')
  const [page, setPage] = useState(1)
  const [retryingId, setRetryingId] = useState(null)

  useEffect(() => {
    fetchEmailLogTypes().then((r) => setTypes(r.types || [])).catch(() => {})
    fetchEmailLogStats().then(setStats).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: 6, search: search || undefined, status: status || undefined, email_type: emailType || undefined }
      const res = await fetchEmailLogs(params)
      setLogs(res.data || [])
      setMeta({ current_page: res.current_page || 1, per_page: res.per_page || 6, total: res.total || 0 })
      const s = await fetchEmailLogStats()
      setStats(s)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, emailType])

  useEffect(() => { load() }, [load])

  const handleRetry = async (log) => {
    setRetryingId(log.id)
    try {
      await retryEmailLog(log.id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setRetryingId(null)
    }
  }

  const typeOptions = [{ value: '', label: 'All types' }, ...types.map((t) => ({ value: t.value, label: t.label }))]

  return (
    <>
      <PageHeader title="Email Monitoring" subtitle="Resend delivery logs — sent, failed, and pending emails">
        <button type="button" className="btn-dx-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </PageHeader>

      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row" style={{ marginBottom: 20 }}>
        <div className="dx-panel" style={{ padding: '14px 18px', margin: 0 }}><strong>{stats.sent}</strong> Sent</div>
        <div className="dx-panel" style={{ padding: '14px 18px', margin: 0 }}><strong>{stats.pending}</strong> Pending</div>
        <div className="dx-panel" style={{ padding: '14px 18px', margin: 0 }}><strong>{stats.failed}</strong> Failed</div>
        <div className="dx-panel" style={{ padding: '14px 18px', margin: 0 }}><strong>{stats.delivered}</strong> Delivered</div>
      </div>

      <div className="dx-panel">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search recipient or subject…" style={{ flex: '1 1 220px', maxWidth: 320 }} />
          <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1) }} label="Status" options={STATUS_OPTS} />
          <FilterSelect value={emailType} onChange={(v) => { setEmailType(v); setPage(1) }} label="Type" options={typeOptions} />
        </div>

        <DataTable
          headers={['Recipient', 'Type', 'Subject', 'Status', 'Sent', 'Actions']}
          loading={loading}
          empty={<EmptyState icon={Mail} title="No email logs yet" message="Emails will appear here when the system sends notifications." />}
        >
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ fontSize: '0.875rem' }}>{log.recipient}</td>
              <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{types.find((t) => t.value === log.email_type)?.label ?? log.email_type}</td>
              <td style={{ fontSize: '0.875rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</td>
              <td><StatusBadge status={log.status === 'sent' ? 'active' : log.status === 'failed' ? 'cancelled' : 'pending'} label={log.status} /></td>
              <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}</td>
              <td>
                {log.status === 'failed' && (
                  <button type="button" className="btn-dx-secondary btn-sm" disabled={retryingId === log.id} onClick={() => handleRetry(log)}>
                    {retryingId === log.id ? 'Retrying…' : 'Retry'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>

        {meta.total > 0 && (
          <PaginationBar page={meta.current_page} perPage={meta.per_page} total={meta.total} onPage={setPage} />
        )}
      </div>
    </>
  )
}

export default AdminEmailLogsPage
