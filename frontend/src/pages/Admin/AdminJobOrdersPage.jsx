/**
 * AdminJobOrdersPage — READ-ONLY job orders view for Admin role.
 *
 * Admin can: view, search, filter, and inspect job order details.
 * Admin cannot: create, edit, delete, dispatch, or assign drivers/vehicles.
 *
 * Dispatch and assignment actions are Dispatcher-role only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJobOrders } from '../../api/dispatcher'
import { EmptyState, FilterSelect, LoadingSpinner, PageHeader, PaginationBar, ProofImageModal, SearchInput } from '../../components/ui'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatJobSchedule } from '../../utils/driverAssignment'
import { formatEventAt } from '../../utils/deliveryTimestamps'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'
import JobOrderRouteMap from '../../components/JobOrderRouteMap'
import { ClipboardList, Info, Loader2 } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'pending',     label: 'Pending' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'in_progress', label: 'En Route' },
  { value: 'arrived',     label: 'Arrived' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

function DetailPanel({ order }) {
  const [proofDocId, setProofDocId] = useState(null)

  if (!order) {
    return (
      <div className="dx-detail-panel" style={{ marginBottom: 0 }}>
        <div className="dx-detail-panel__top">
          <h2 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--muted)' }}>Job details</h2>
        </div>
        <div className="dx-detail-panel__body">
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
            Select a job order to view its details.
          </p>
        </div>
      </div>
    )
  }

  const assignment = order.assignments?.[0]
  const departureDoc = assignment?.delivery_documents?.find((d) => d.type === 'departure')

  const kv = (label, value) => (
    <div className="dx-kv" key={label}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )

  return (
    <>
    <div className="dx-detail-panel" style={{ marginBottom: 0 }}>
      <div className="dx-detail-panel__top">
        <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>
          {formatJobPublicId(order.id)}
        </h2>
        <span className={jobStatusBadgeClass(order.status)} style={{ fontSize: '0.75rem' }}>
          {formatJobStatus(order.status)}
        </span>
      </div>

      <div className="dx-detail-panel__body">
        {/* Read-only admin notice */}
        <div className="dx-readonly-notice" style={{ marginBottom: 14 }}>
          <Info size={14} aria-hidden />
          Admin view only — dispatch and assignment actions are handled by the Dispatcher.
        </div>

        {kv('Client', order.client?.client_name || order.custom_client_name || buildDisplayName(order))}
        {kv('Contact', order.customer_contact ?? order.customer_email)}
        <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
          <span>Pickup</span>
          <strong style={{ textAlign: 'right' }}>{buildDisplayAddress('pickup', order) || '—'}</strong>
        </div>
        <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
          <span>Destination</span>
          <strong style={{ textAlign: 'right' }}>{buildDisplayAddress('dropoff', order) || '—'}</strong>
        </div>
        <JobOrderRouteMap jobOrderId={order.id} readOnly />
        {order.material_type && kv('Material', `${order.material_type}${order.specification_size ? ` · ${order.specification_size}` : ''}`)}
        {kv('Load', order.load_volume_m3 || order.volume_m3 ? `${order.load_volume_m3 ?? order.volume_m3} m³` : null)}
        {kv('Quarry', order.quarry?.quarry_name)}
        {kv('Schedule', order.scheduled_start || order.scheduled_end ? formatJobSchedule(order) : null)}
        {kv('Priority', order.priority ? order.priority.charAt(0).toUpperCase() + order.priority.slice(1) : null)}
        {kv('Tracking', order.tracking_code)}

        {/* Assignment (read-only) */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--stroke)' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>
            Assignment
          </p>
          {assignment ? (
            <>
              {kv('Driver',  assignment.driver?.user?.name ?? '—')}
              {kv('Vehicle', assignment.vehicle?.plate_no ?? '—')}
              {kv('Assigned at', formatEventAt({ assigned_event_at: assignment.assigned_event_at, assigned_at: assignment.assigned_at }) ?? '—')}
            </>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: 0 }}>
              Not yet assigned.
            </p>
          )}
        </div>

        {/* En Route Proof */}
        {assignment && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--stroke)' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>
              En Route Proof
            </p>
            {departureDoc ? (
              <button
                type="button"
                className="btn-dx-secondary btn-sm"
                onClick={() => setProofDocId(departureDoc.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                🖼 View En Route Proof
              </button>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: 0 }}>
                No departure photo uploaded.
              </p>
            )}
          </div>
        )}

        {order.job_requirements && (
          <div className="dx-kv" style={{ alignItems: 'flex-start', marginTop: 8 }}>
            <span>Handling</span>
            <strong>{order.job_requirements}</strong>
          </div>
        )}
      </div>
    </div>

    {proofDocId && (
      <ProofImageModal
        documentId={proofDocId}
        title="En Route Proof"
        onClose={() => setProofDocId(null)}
      />
    )}
    </>
  )
}

function AdminJobOrdersPage() {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('all')
  const [page, setPage]         = useState(1)
  const [perPage]   = useState(6)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchJobOrders(1)
      setOrders(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* Client-side filter */
  const filtered = useMemo(() => orders.filter((o) => {
    const matchStatus = status === 'all' || o.status === status
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

  /* Reset page when filters change */
  useEffect(() => { setPage(1) }, [search, status, perPage])

  /* Paginated slice */
  const pagedOrders = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  )

  return (
    <section>
      <PageHeader title="Job Orders" subtitle="View and monitor all job orders across the system — read-only" />
      {error && <p className="notice error">{error}</p>}

      {/* Filter bar */}
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

      <div className="dx-split-bestfit" style={{ gridTemplateColumns: '1fr 340px', gap: 20 }}>
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
                <button
                  key={order.id}
                  type="button"
                  className={`dx-mobile-card${selected?.id === order.id ? ' dx-mobile-card--selected' : ''}`}
                  onClick={() => setSelected(order)}
                >
                  <div className="dx-mobile-card__row">
                    <span className="dx-mobile-card__title">{formatJobPublicId(order.id)}</span>
                    <span className={jobStatusBadgeClass(order.status)}>{formatJobStatus(order.status)}</span>
                  </div>
                  <p className="dx-mobile-card__meta">
                    {order.client?.client_name || order.custom_client_name || buildDisplayName(order)}
                  </p>
                  <p className="dx-mobile-card__meta">
                    {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                  </p>
                  <p className="dx-mobile-card__meta">
                    Priority: {order.priority} · {formatJobSchedule(order)}
                  </p>
                  {order.tracking_code && (
                    <p className="dx-mobile-card__meta">Tracking: {order.tracking_code}</p>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="dx-data-table-wrap dx-data-table-wrap--stack dx-data-table-wrap--cards-mobile">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Client</th>
                  <th>Route</th>
                  <th>Priority</th>
                  <th>Schedule</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j}>
                          <div style={{ height: 14, borderRadius: 6, background: 'var(--slate-200)', width: j === 0 ? '70%' : '55%', animation: 'shimmer 1.4s infinite' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={ClipboardList}
                        title="No job orders found"
                        message={search || status !== 'all' ? 'No orders match your filter.' : 'Job orders will appear here once created.'}
                      />
                    </td>
                  </tr>
                ) : (
                  pagedOrders.map((order) => (
                    <tr
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(order)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(order) } }}
                      className={selected?.id === order.id ? 'is-selected' : undefined}
                      style={{ cursor: 'pointer' }}
                    >
                      <td data-label="Job ID">
                        <span className="job-link">{formatJobPublicId(order.id)}</span>
                      </td>
                      <td data-label="Client" style={{ fontWeight: 500 }}>
                        {order.client?.client_name || order.custom_client_name || buildDisplayName(order)}
                      </td>
                      <td data-label="Route" style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                        {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                      </td>
                      <td data-label="Priority" style={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{order.priority}</td>
                      <td data-label="Schedule" style={{ fontSize: '0.8125rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {formatJobSchedule(order)}
                      </td>
                      <td data-label="Status">
                        <span className={jobStatusBadgeClass(order.status)}>
                          {formatJobStatus(order.status)}
                        </span>
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

        {/* Read-only detail panel */}
        <DetailPanel order={selected} />
      </div>
    </section>
  )
}

export default AdminJobOrdersPage
