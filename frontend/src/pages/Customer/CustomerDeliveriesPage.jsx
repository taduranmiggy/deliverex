import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '../../components/ui'
import { Package, ArrowRight } from 'lucide-react'

function formatDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function CustomerDeliveriesPage() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) setRows(res?.data ?? []) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const isTerminal = (s) => ['completed', 'cancelled'].includes(String(s || '').toLowerCase())
  const active    = rows.filter((r) => !isTerminal(r.status))
  const completed = rows.filter((r) => isTerminal(r.status))

  const DeliveryRow = ({ r }) => (
    <tr>
      <td>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', background: 'var(--slate-100)', padding: '3px 8px', borderRadius: 6 }}>
          {r.tracking_code}
        </span>
      </td>
      <td><StatusBadge status={r.status} /></td>
      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{formatDate(r.status_at || r.updated_at)}</td>
      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
        {r.pickup_location} → {r.dropoff_location}
      </td>
      <td>
        {Array.isArray(r.documents) && r.documents.length > 0
          ? r.documents.map((doc) => (
              <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="auth-inline-link" style={{ fontSize: '0.8125rem' }}>
                POD {doc.uploaded_at ? `(${formatDate(doc.uploaded_at)})` : ''}
              </a>
            ))
          : <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>—</span>}
      </td>
      <td>
        <Link className="btn-dx-secondary btn-sm" to="/customer/track" state={{ prefillTracking: r.tracking_code }}>
          Track
        </Link>
      </td>
    </tr>
  )

  return (
    <div className="customer-content" style={{ paddingTop: 32 }}>
      <PageHeader title="My Deliveries" subtitle="Shipments associated with your customer account.">
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
          {active.length > 0 && (
            <SectionCard>
              <div className="dx-section-header">
                <div>
                  <h2>Active Deliveries</h2>
                  <p>In-progress shipments and upcoming scheduled drops.</p>
                </div>
                <span className="dx-section-count">{active.length} active</span>
              </div>
              <div className="dx-data-table-wrap">
                <table className="dx-data-table">
                  <thead><tr>
                    <th>Tracking</th><th>Status</th><th>Updated</th><th>Route</th><th>POD</th><th />
                  </tr></thead>
                  <tbody>{active.map((r) => <DeliveryRow key={r.id} r={r} />)}</tbody>
                </table>
              </div>
            </SectionCard>
          )}
          {completed.length > 0 && (
            <SectionCard>
              <div className="dx-section-header">
                <div>
                  <h2>Delivery History</h2>
                  <p>Completed deliveries with proof-of-delivery documents.</p>
                </div>
                <span className="dx-section-count">{completed.length} completed</span>
              </div>
              <div className="dx-data-table-wrap">
                <table className="dx-data-table">
                  <thead><tr>
                    <th>Tracking</th><th>Status</th><th>Completed</th><th>Route</th><th>POD</th><th />
                  </tr></thead>
                  <tbody>{completed.map((r) => <DeliveryRow key={r.id} r={r} />)}</tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerDeliveriesPage
