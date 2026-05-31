import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAssignments, fetchJobOrders } from '../../api/dispatcher'
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from '../../components/ui'
import { AlertTriangle, ArrowRight, Clock, MapPin, Truck } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'

function DispatcherDashboard() {
  const [summary, setSummary]   = useState({ orders: 0, pending: 0, active: 0, delayed: 0 })
  const [deliveries, setDeliveries] = useState([])
  const [error, setError]       = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [orders, assignments] = await Promise.all([fetchJobOrders(1), fetchAssignments(1)])
        const allOrders  = orders.data || []
        const allAssign  = assignments.data || []
        const active     = allAssign.filter((a) => !['completed', 'cancelled'].includes(a.status))
        const now        = Date.now()
        const delayed    = active.filter((a) => {
          const end = a.job_order?.scheduled_end
          return end && new Date(end).getTime() < now
        }).length
        setSummary({
          orders:  orders.total ?? allOrders.length,
          pending: allOrders.filter((o) => o.status === 'pending').length,
          active:  active.length,
          delayed,
        })
        setDeliveries(active.slice(0, 8))
      } catch (err) { setError(err.message) }
    }
    load()
  }, [])

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of dispatch operations" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <StatCard label="Active Deliveries"    value={summary.active}   icon={Truck}         iconVariant="default" />
        <StatCard label="Pending Assignment"   value={summary.pending}  icon={Clock}         iconVariant="yellow" />
        <StatCard label="Total Job Orders"     value={summary.orders}   icon={MapPin}        iconVariant="purple" />
        <StatCard label="Delayed"              value={summary.delayed}  icon={AlertTriangle} iconVariant={summary.delayed > 0 ? 'red' : 'green'} />
      </div>

      {summary.pending > 0 && (
        <div className="notice" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <span style={{ fontWeight: 600 }}>
            {summary.pending} job{summary.pending > 1 ? 's' : ''} awaiting assignment
          </span>
          <Link to="/dispatcher/dispatch-best-fit" className="btn-dx-primary btn-sm">
            Dispatch now <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'flex-start' }}>
        <SectionCard title="Active Deliveries"
          action={<Link to="/dispatcher/live-tracking" className="btn-dx-secondary btn-sm">View map →</Link>}
        >
          {deliveries.length === 0 ? (
            <EmptyState icon={Truck} title="No active deliveries" message="Assign jobs to see active deliveries here." />
          ) : (
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead><tr>
                  <th>Job ID</th><th>Client</th><th>Route</th><th>Priority</th><th>Status</th><th>Driver</th>
                </tr></thead>
                <tbody>
                  {deliveries.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem' }}>{formatJobPublicId(item.job_order_id)}</td>
                      <td style={{ fontWeight: 600 }}>{item.job_order?.customer_name ?? '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                        {item.job_order?.pickup_location ?? '—'} → {item.job_order?.dropoff_location ?? '—'}
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.8125rem', color: 'var(--muted)' }}>{item.job_order?.priority ?? '—'}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td style={{ fontSize: '0.875rem' }}>{item.driver?.user?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionCard title="Quick Actions">
            {[
              { label: 'Create Job Order',   to: '/dispatcher/job-orders',        cls: 'btn-dx-primary' },
              { label: 'Fleet Dispatch',      to: '/dispatcher/dispatch-best-fit', cls: 'btn-dx-secondary' },
              { label: 'Calendar',            to: '/dispatcher/calendar',          cls: 'btn-dx-secondary' },
              { label: 'View Inquiries',      to: '/dispatcher/inquiries',          cls: 'btn-dx-secondary' },
              { label: 'Tracking',            to: '/dispatcher/live-tracking',      cls: 'btn-dx-secondary' },
            ].map(({ label, to, cls }) => (
              <Link key={to} to={to} className={`${cls} btn-sm`} style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start', gap: 8 }}>
                {label}
              </Link>
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  )
}

export default DispatcherDashboard
