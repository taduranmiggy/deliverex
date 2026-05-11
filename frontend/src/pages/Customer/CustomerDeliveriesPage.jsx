import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'

function CustomerDeliveriesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Tracking</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.tracking_code}</strong>
                    </td>
                    <td>{r.status}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {r.pickup_location} … {r.dropoff_location}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {Array.isArray(r.documents) && r.documents.length > 0
                        ? `${r.documents.length} on file`
                        : '—'}
                    </td>
                    <td>
                      <Link
                        className="auth-inline-link"
                        style={{ fontWeight: 600 }}
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
        `}
      </style>
    </section>
  )
}

export default CustomerDeliveriesPage
