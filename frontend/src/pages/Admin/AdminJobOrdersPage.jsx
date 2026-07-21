/**
 * AdminJobOrdersPage — READ-ONLY job orders view for Admin role.
 *
 * Slim list matching Dispatcher Job Orders (Job ID | Client | View).
 * Details open in JobOrderViewModal (readOnly — no edit/dispatch/delete).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJobOrders } from '../../api/dispatcher'
import JobOrderViewModal from '../../components/JobOrderViewModal'
import { EmptyState, FilterSelect, LoadingSpinner, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import { buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatJobPublicId } from '../../utils/formatPhp'
import { ClipboardList, Loader2 } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'pending',     label: 'Pending' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'in_progress', label: 'En Route' },
  { value: 'arrived',     label: 'Arrived' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'archive',     label: 'Archive' },
]

function AdminJobOrdersPage() {
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [viewOrder, setViewOrder] = useState(null)
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState('all')
  const [page, setPage]           = useState(1)
  const [perPage]                 = useState(6)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchJobOrders(1, 500, { includeArchived: true })
      setOrders(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => orders.filter((o) => {
    const matchStatus = status === 'all'
      || (status === 'archive' && o.is_archived)
      || (status !== 'archive' && !o.is_archived && o.status === status)
    const q = search.toLowerCase()
    const matchSearch = !q || [
      o.tracking_code,
      o.client?.client_name,
      o.custom_client_name,
      buildDisplayName(o),
      o.material_type,
      formatJobPublicId(o.id),
    ].some((v) => v && String(v).toLowerCase().includes(q))
    return matchStatus && matchSearch
  }), [orders, search, status])

  useEffect(() => { setPage(1) }, [search, status, perPage])

  const pagedOrders = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  )

  const clientLabel = (order) =>
    order.client?.client_name || order.custom_client_name || buildDisplayName(order)

  return (
    <section>
      <PageHeader title="Job Orders" subtitle="View and monitor all job orders across the system — read-only" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by ID, client, material, tracking…"
          style={{ flex: 1, maxWidth: 320 }}
        />
        <FilterSelect value={status} onChange={setStatus} label="Status" options={STATUS_OPTIONS} />
        <button type="button" className="btn-dx-secondary" onClick={load} disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Refreshing…</> : 'Refresh'}
        </button>
      </div>

      <div className="dx-panel" style={{ marginBottom: 0 }}>
        <div className="dx-mobile-card-list dx-mobile-card-list--show">
          {loading ? (
            <LoadingSpinner label="Loading job orders…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No job orders found"
              message={search || status !== 'all' ? 'No orders match your filter.' : 'Job orders will appear here once created.'}
            />
          ) : (
            pagedOrders.map((order) => (
              <div key={order.id} className="dx-mobile-card">
                <div className="dx-mobile-card__row">
                  <span className="dx-mobile-card__title">{formatJobPublicId(order.id)}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="dx-mobile-card__meta">{clientLabel(order)}</p>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-dx-secondary btn-sm"
                    onClick={() => setViewOrder(order)}
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="dx-data-table-wrap dx-data-table-wrap--stack dx-data-table-wrap--cards-mobile">
          <table className="dx-data-table dx-job-orders-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Client</th>
                <th className="dx-job-orders-table__status">Status</th>
                <th className="dx-job-orders-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j}>
                        <div style={{ height: 14, borderRadius: 6, background: 'var(--slate-200)', width: j === 0 ? '70%' : '55%', animation: 'shimmer 1.4s infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={ClipboardList}
                      title="No job orders found"
                      message={search || status !== 'all' ? 'No orders match your filter.' : 'Job orders will appear here once created.'}
                    />
                  </td>
                </tr>
              ) : (
                pagedOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Job ID">
                      <span className="job-link">{formatJobPublicId(order.id)}</span>
                    </td>
                    <td data-label="Client" style={{ fontWeight: 500 }}>
                      {clientLabel(order)}
                    </td>
                    <td className="dx-job-orders-table__status" data-label="Status">
                      <StatusBadge status={order.is_archived ? 'archive' : order.status} />
                    </td>
                    <td className="dx-job-orders-table__actions" data-label="Actions">
                      <button
                        type="button"
                        className="btn-dx-secondary btn-sm"
                        onClick={() => setViewOrder(order)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <PaginationBar
            page={page}
            perPage={perPage}
            total={filtered.length}
            onPage={setPage}
          />
        )}
      </div>

      {viewOrder && (
        <JobOrderViewModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          readOnly
        />
      )}
    </section>
  )
}

export default AdminJobOrdersPage
