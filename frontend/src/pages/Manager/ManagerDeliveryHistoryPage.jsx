import { useCallback, useEffect, useState } from 'react'
import { fetchReports } from '../../api/manager'
import { buildDisplayName } from '../../utils/jobOrderHelpers'
import { DataTable, EmptyState, FilterSelect, PageHeader, SectionCard, StatusBadge } from '../../components/ui'
import { History } from 'lucide-react'

function ManagerDeliveryHistoryPage() {
  const [history, setHistory] = useState([])
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(1)
  const [meta, setMeta]       = useState({ last_page: 1, total: 0 })
  const [status, setStatus]   = useState('')

  const load = useCallback(async (p = 1, s = '') => {
    setLoading(true); setError('')
    try {
      const res = await fetchReports(p, s)
      setHistory(res.data || [])
      setMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page, status) }, [page]) // eslint-disable-line

  return (
    <>
      <PageHeader title="Delivery History" subtitle={`Complete history of all deliveries${meta.total > 0 ? ` · ${meta.total} records` : ''}`} />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1); load(1, v) }} label="Status" options={[
            { value: '', label: 'All statuses' }, { value: 'completed', label: 'Completed' },
            { value: 'in_progress', label: 'In Progress' }, { value: 'assigned', label: 'Assigned' }, { value: 'cancelled', label: 'Cancelled' },
          ]} />
        </div>

        <DataTable
          headers={['Assignment', 'Client', 'Driver', 'Vehicle', 'Status', 'Assigned', 'Completed']}
          loading={loading}
          empty={<EmptyState icon={History} title="No deliveries found" message="Try adjusting the status filter." />}
        >
          {history.length > 0 && history.map((item) => (
            <tr key={item.id}>
              <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--muted)' }}>#{item.id}</td>
              <td style={{ fontWeight: 600 }}>{buildDisplayName(item.job_order) || '—'}</td>
              <td>{item.driver?.user?.name ?? '—'}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{item.vehicle?.plate_no ?? '—'}</td>
              <td><StatusBadge status={item.status} /></td>
              <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                {item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : '—'}
              </td>
              <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '—'}
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
      </div>
    </>
  )
}

export default ManagerDeliveryHistoryPage
