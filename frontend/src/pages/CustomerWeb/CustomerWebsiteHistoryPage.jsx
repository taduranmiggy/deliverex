import { useEffect, useMemo, useState } from 'react'
import { fetchCustomerOrders } from '../../api/customer'
import { StatusBadge } from '../../components/ui'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'

function CustomerWebsiteHistoryPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) setOrders(res?.data ?? []) })
      .catch(() => { if (!cancelled) setOrders([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)),
    [orders],
  )

  return (
    <div className="customer-web-page">
      <div className="customer-web-page-head">
        <h2>Delivery History</h2>
        <p>Desktop history view of shipments linked to your account.</p>
      </div>

      {loading ? <p className="customer-web-muted">Loading delivery history...</p> : null}

      {!loading && sorted.length === 0 ? (
        <p className="customer-web-muted">No deliveries linked to your account yet.</p>
      ) : (
        <div className="customer-web-table-wrap">
          <table className="customer-web-table">
            <thead>
              <tr>
                <th>Tracking ID</th>
                <th>Status</th>
                <th>Pickup</th>
                <th>Dropoff</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((order) => (
                <tr key={order.id}>
                  <td className="customer-web-mono">{order.tracking_code}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{buildDisplayAddress('pickup', order)}</td>
                  <td>{buildDisplayAddress('dropoff', order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CustomerWebsiteHistoryPage
