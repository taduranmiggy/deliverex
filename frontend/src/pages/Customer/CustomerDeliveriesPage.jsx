import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'

function CustomerDeliveriesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isTerminalStatus = (status) => {
    const value = String(status || '').toLowerCase()
    return value === 'completed' || value === 'cancelled'
  }

  const formatDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchCustomerOrders()
        if (!cancelled) {
          setRows(res?.data ?? [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="dx-customer-scope">
      <header className="page-header">
        <div className="header-stack">
          <h1>My deliveries</h1>
          <p>Shipments associated with your customer account.</p>
        </div>
        <Link className="dx-cust-second-btn" to="/customer/track">
          Track another code
        </Link>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {loading ? <p style={{ color: 'var(--muted)' }}>Loading…</p> : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="dx-panel">
          <p style={{ margin: 0 }}>
            No shipments are linked to this account yet. When operations books jobs under your email, they will appear
            here. You can also{' '}
            <Link className="auth-inline-link" to="/customer/track">
              track using a tracking code
            </Link>
            .
          </p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="dx-customer-sections">
          <div className="dx-panel">
            <div className="dx-section-header">
              <div>
                <h2>Active deliveries</h2>
                <p>In progress shipments and upcoming scheduled drops.</p>
              </div>
              <span className="dx-section-count">
                {rows.filter((r) => !isTerminalStatus(r.status)).length} active
              </span>
            </div>
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Tracking</th>
                    <th>Status</th>
                    <th>Status updated</th>
                    <th>Route</th>
                    <th>Proof of delivery</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => !isTerminalStatus(r.status)).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.tracking_code}</strong>
                      </td>
                      <td>{r.status}</td>
                      <td className="dx-muted">{formatDate(r.status_at || r.updated_at)}</td>
                      <td className="dx-muted">
                        {r.pickup_location} → {r.dropoff_location}
                      </td>
                      <td className="dx-muted">Available after completion</td>
                      <td>
                        <Link
                          className="auth-inline-link dx-strong-link"
                          to="/customer/track"
                          state={{ prefillTracking: r.tracking_code }}
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dx-panel" style={{ marginBottom: 0 }}>
            <div className="dx-section-header">
              <div>
                <h2>Delivery history</h2>
                <p>Completed deliveries with proof-of-delivery documents.</p>
              </div>
              <span className="dx-section-count">
                {rows.filter((r) => isTerminalStatus(r.status)).length} completed
              </span>
            </div>
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead>
                  <tr>
                    <th>Tracking</th>
                    <th>Status</th>
                    <th>Status updated</th>
                    <th>Route</th>
                    <th>Proof of delivery</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => isTerminalStatus(r.status)).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.tracking_code}</strong>
                      </td>
                      <td>{r.status}</td>
                      <td className="dx-muted">{formatDate(r.status_at || r.updated_at)}</td>
                      <td className="dx-muted">
                        {r.pickup_location} → {r.dropoff_location}
                      </td>
                      <td>
                        {Array.isArray(r.documents) && r.documents.length > 0 ? (
                          <div className="dx-doc-list">
                            {r.documents.map((doc) => (
                              <a
                                key={doc.id}
                                className="auth-inline-link"
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                POD {doc.uploaded_at ? `(${formatDate(doc.uploaded_at)})` : ''}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="dx-muted">—</span>
                        )}
                      </td>
                      <td>
                        <Link
                          className="auth-inline-link dx-strong-link"
                          to="/customer/track"
                          state={{ prefillTracking: r.tracking_code }}
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      <style>
        {`
          .dx-cust-second-btn {
            align-self: center;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid var(--stroke);
            background: #fff;
            font-weight: 600;
            text-decoration: none;
            font-size: 0.875rem;
            color: var(--text);
          }
          .dx-cust-second-btn:hover {
            background: var(--surface-soft);
          }
          .dx-customer-sections {
            display: grid;
            gap: 18px;
          }
          .dx-section-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
          }
          .dx-section-header h2 {
            margin: 0;
            font-size: 1.1rem;
          }
          .dx-section-header p {
            margin: 4px 0 0;
            color: var(--muted);
            font-size: 0.875rem;
          }
          .dx-section-count {
            font-size: 0.8125rem;
            color: var(--muted);
            font-weight: 600;
          }
          .dx-muted {
            color: var(--muted);
            font-size: 0.8125rem;
          }
          .dx-strong-link {
            font-weight: 600;
          }
          .dx-doc-list {
            display: grid;
            gap: 4px;
          }
        `}
      </style>
    </section>
  )
}

export default CustomerDeliveriesPage
