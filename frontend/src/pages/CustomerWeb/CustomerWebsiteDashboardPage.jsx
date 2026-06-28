import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'

function StatCard({ label, value }) {
  return (
    <article className="customer-web-stat">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  )
}

function CustomerWebsiteDashboardPage() {
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

  const stats = useMemo(() => {
    const summary = { total: orders.length, active: 0, completed: 0 }
    orders.forEach((order) => {
      if (order.status === 'completed') summary.completed += 1
      else summary.active += 1
    })
    return summary
  }, [orders])

  return (
    <div className="customer-web-page">
      <div className="customer-web-page-head">
        <h2>Dashboard</h2>
        <p>Overview of your deliveries using the same customer account and backend data.</p>
      </div>
      <div className="customer-web-stats-grid">
        <StatCard label="Total Shipments" value={stats.total} />
        <StatCard label="Active Shipments" value={stats.active} />
        <StatCard label="Completed Shipments" value={stats.completed} />
      </div>

      <div className="customer-web-quick-links">
        <Link to="/customer-web/history" className="btn-dx-primary">
          Open Delivery History
        </Link>
        <Link to="/customer-web/profile" className="btn-dx-secondary">
          Manage Profile
        </Link>
      </div>

      {loading ? <p className="customer-web-muted">Loading dashboard data...</p> : null}
    </div>
  )
}

export default CustomerWebsiteDashboardPage
