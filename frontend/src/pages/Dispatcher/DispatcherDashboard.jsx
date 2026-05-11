import { useEffect, useMemo, useState } from 'react'
import { fetchAssignments, fetchJobOrders } from '../../api/dispatcher'
import { IconAlertTriangle, IconClock, IconMapPinFilled, IconTruck } from '../../components/DxIcons'
import { formatDemoPhp, formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'

function formatRouteLabel(pickup, dropoff) {
  if (pickup && dropoff) return `${pickup} to ${dropoff}`
  return pickup || dropoff || '—'
}

function DispatcherDashboard() {
  const [summary, setSummary] = useState({ orders: 0, assignments: 0 })
  const [activeDeliveries, setActiveDeliveries] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [orders, assignments] = await Promise.all([
          fetchJobOrders(1),
          fetchAssignments(1),
        ])
        setSummary({
          orders: orders.total ?? orders.data?.length ?? 0,
          assignments: assignments.total ?? assignments.data?.length ?? 0,
        })
        setActiveDeliveries(assignments.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadSummary()
  }, [])

  const pins = useMemo(() => activeDeliveries.length, [activeDeliveries])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Dashboard</h1>
          <p>Overview of dispatch operations</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconTruck />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Active Deliveries</div>
            <div className="dx-stat-card__value">{summary.assignments}</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconClock />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Avg Assignment Time</div>
            <div className="dx-stat-card__value">1.8 min</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconAlertTriangle />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Delayed Today</div>
            <div className="dx-stat-card__value">0</div>
          </div>
        </div>
      </div>

      <div className="dx-panel">
        <h2 className="dx-panel-title">Active Deliveries</h2>
        <div className="dx-data-table-wrap">
          <table className="dx-data-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Client</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Driver</th>
              </tr>
            </thead>
            <tbody>
              {activeDeliveries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center' }}>
                    No active deliveries yet.
                  </td>
                </tr>
              )}
              {activeDeliveries.map((item) => (
                <tr key={item.id}>
                  <td>{formatJobPublicId(item.job_order_id)}</td>
                  <td>{item.job_order?.customer_name ?? '—'}</td>
                  <td>
                    {formatRouteLabel(item.job_order?.pickup_location, item.job_order?.dropoff_location)}
                  </td>
                  <td>{formatDemoPhp(item.job_order_id)}</td>
                  <td>
                    <span className={jobStatusBadgeClass(item.status)}>
                      {formatJobStatus(item.status)}
                    </span>
                  </td>
                  <td>{item.driver?.user?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dx-panel">
        <h2 className="dx-panel-title">Live Map</h2>
        <div className="dx-live-map-shell">
          {[12, 28, 55, 72].slice(0, Math.min(pins, 4)).map((top, i) => (
            <span key={i} className="dx-map-pin" style={{ left: `${18 + i * 22}%`, top: `${top}%` }} aria-hidden>
              <IconMapPinFilled />
            </span>
          ))}
          <div className="dx-live-map-msg">
            <strong>{pins || 0} drivers active</strong>
            <span>Hover over pins for details</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DispatcherDashboard
