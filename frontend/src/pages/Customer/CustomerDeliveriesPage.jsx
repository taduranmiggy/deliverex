import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '../../components/ui'
import { Package } from 'lucide-react'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'

function formatDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function CustomerDeliveriesPage() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('all')

  useEffect(() => {
    let cancelled = false
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) setRows(res?.data ?? []) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const ACTIVE_STATUSES = new Set(['pending', 'assigned', 'dispatched', 'in_progress', 'en_route', 'arrived'])
  const COMPLETED_STATUSES = new Set(['completed', 'completed_with_pod'])

  const filteredRows = rows.filter((r) => {
    const status = String(r.status || '').toLowerCase()
    if (tab === 'active') return ACTIVE_STATUSES.has(status)
    if (tab === 'completed') return COMPLETED_STATUSES.has(status)
    return true
  })

  const DeliveryRow = ({ r }) => (
    <tr>
      <td>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', background: 'var(--slate-100)', padding: '3px 8px', borderRadius: 6 }}>
          {r.tracking_code || `#${r.id}`}
        </span>
      </td>
      <td><StatusBadge status={r.status} /></td>
      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(r.status_at || r.updated_at)}</td>
      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
        {buildDisplayAddress('pickup', r)} → {buildDisplayAddress('dropoff', r)}
      </td>
      <td>
        {Array.isArray(r.documents) && r.documents.length > 0
          ? (
            <a href={r.documents[0].url} target="_blank" rel="noreferrer" className="auth-inline-link" style={{ fontSize: '0.8125rem' }}>
              Available
            </a>
            )
          : <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>—</span>}
      </td>
      <td style={{ display: 'flex', gap: 8 }}>
        <Link className="btn-dx-secondary btn-sm" to="/customer/track" state={{ prefillTracking: r.tracking_code }}>
          Track
        </Link>
        <Link className="btn-dx-primary btn-sm" to="/customer/track" state={{ prefillTracking: r.tracking_code }}>
          View
        </Link>
      </td>
    </tr>
  )

  return (
    <div className="customer-content" style={{ paddingTop: 32 }}>
      <PageHeader title="My Deliveries" subtitle="View all delivery transactions and tracking status.">
        <Link to="/customer/track" className="btn-dx-secondary btn-sm">Track another code</Link>
      </PageHeader>

      {error && <p className="notice error">{error}</p>}

      {loading ? (
        <div className="dx-panel" style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px' }}>Loading your deliveries…</div>
      ) : rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Package}
            title="No deliveries yet"
            message="When operations books jobs under your email, they will appear here. You can also track using a tracking code."
            action={<Link to="/customer/track" className="btn-dx-primary">Track a delivery</Link>}
          />
        </SectionCard>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <SectionCard>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'completed', label: 'Completed' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`dx-ocr-tab${tab === item.key ? ' dx-ocr-tab--active' : ''}`}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead><tr>
                  <th>Job Order ID</th><th>Status</th><th>Last Update</th><th>Route</th><th>PoD</th><th>View</th>
                </tr></thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No deliveries found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => <DeliveryRow key={r.id} r={r} />)
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default CustomerDeliveriesPage
