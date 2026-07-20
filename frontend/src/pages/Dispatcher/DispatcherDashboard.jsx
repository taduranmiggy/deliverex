import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchAssignments, fetchJobOrders } from '../../api/dispatcher'
import AssignmentAuditSection from '../../components/AssignmentAuditSection'
import IssueReportsSection from '../../components/IssueReportsSection'
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from '../../components/ui'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, ListOrdered, Truck } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayName, buildRouteSummary } from '../../utils/jobOrderHelpers'
import { getDelayReasonLabel } from '../../utils/driverAssignment'
import { formatEventAt } from '../../utils/deliveryTimestamps'

function DispatcherDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState({ orders: 0, pending: 0, active: 0, delayed: 0, delivered: 0 })
  const [deliveries, setDeliveries] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const [ordersResult, assignmentsResult] = await Promise.allSettled([
        fetchJobOrders(1, 100),
        fetchAssignments(1),
      ])

      const errors = []
      let allOrders = []
      let ordersTotal = 0
      let allAssign = []

      if (ordersResult.status === 'fulfilled') {
        allOrders = ordersResult.value.data || []
        ordersTotal = ordersResult.value.total ?? allOrders.length
      } else {
        errors.push(ordersResult.reason?.message || 'Failed to load job orders')
      }

      if (assignmentsResult.status === 'fulfilled') {
        allAssign = assignmentsResult.value.data || []
      } else {
        errors.push(assignmentsResult.reason?.message || 'Failed to load assignments')
      }

      if (errors.length > 0) {
        setError(errors.join(' · '))
      }

      const active = allAssign.filter((a) => !['completed', 'cancelled'].includes(a.status))
      const now = Date.now()
      const delayed = active.filter((a) => {
        const end = a.job_order?.scheduled_end
        return end && new Date(end).getTime() < now
      }).length
      const delivered = allOrders.filter((o) => o.status === 'completed').length

      setSummary({
        orders: ordersTotal,
        pending: allOrders.filter((o) => o.status === 'pending').length,
        active: active.length,
        delayed,
        delivered,
      })
      setDeliveries(active.slice(0, 8))
    }
    load()
  }, [])

  const goJobs = (initialTab) => navigate('/dispatcher/job-orders', { state: { initialTab } })

  return (
    <div className="dispatcher-dashboard">
      <PageHeader title="Dashboard" subtitle="Overview of dispatch operations" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <StatCard
          label="Pending Assignment"
          value={summary.pending}
          icon={Clock}
          iconVariant="yellow"
          hint="Open Fleet Dispatch"
          onClick={() => navigate('/dispatcher/dispatch')}
        />
        <StatCard
          label="Active Deliveries"
          value={summary.active}
          icon={Truck}
          iconVariant="default"
          hint="View active jobs"
          onClick={() => goJobs('active')}
        />
        <StatCard
          label="Delivered"
          value={summary.delivered}
          icon={CheckCircle2}
          iconVariant="green"
          hint="View completed"
          onClick={() => goJobs('completed')}
        />
        <StatCard
          label="Delayed"
          value={summary.delayed}
          icon={AlertTriangle}
          iconVariant={summary.delayed > 0 ? 'red' : 'green'}
          hint="View active jobs"
          onClick={() => goJobs('active')}
        />
      </div>

      <div className="dispatcher-dashboard__meta">
        <StatCard
          label="Total Job Orders"
          value={summary.orders}
          icon={ListOrdered}
          iconVariant="purple"
          hint="View all"
          onClick={() => goJobs('all')}
          secondary
        />
      </div>

      {summary.pending > 0 && (
        <div className="notice dispatcher-dashboard__banner">
          <span style={{ fontWeight: 600 }}>
            {summary.pending} job{summary.pending > 1 ? 's' : ''} awaiting assignment
          </span>
          <Link to="/dispatcher/dispatch" className="btn-dx-primary btn-sm">
            Dispatch now <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="dx-grid-sidebar dispatcher-dashboard__main">
        <SectionCard
          title="Active Deliveries"
          action={<Link to="/dispatcher/live-tracking" className="btn-dx-secondary btn-sm">View map →</Link>}
        >
          {deliveries.length === 0 ? (
            <EmptyState icon={Truck} title="No active deliveries" message="Assign jobs to see active deliveries here." />
          ) : (
            <div className="dx-data-table-wrap dx-data-table-wrap--dashboard-deliveries">
              <table className="dx-data-table dx-data-table--dashboard-deliveries">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Client</th>
                    <th>Route</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Arrival</th>
                    <th>Delay Reason</th>
                    <th>Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((item) => {
                    const delay = item.latest_delay_report
                    const arrivedLog = item.latest_arrived_status_log
                    const isPastDue = item.job_order?.scheduled_end && new Date(item.job_order.scheduled_end).getTime() < Date.now()
                    const routeLabel = buildRouteSummary(item.job_order)
                    const priority = item.job_order?.priority ?? 'normal'
                    const priorityCls = priority === 'urgent' || priority === 'high'
                      ? 'badge-dx badge-dx--prio-high'
                      : priority === 'low'
                        ? 'badge-dx badge-dx--muted'
                        : 'badge-dx badge-dx--prio-medium'
                    return (
                      <tr key={item.id}>
                        <td className="dx-dashboard-deliveries__id">{formatJobPublicId(item.job_order_id)}</td>
                        <td className="dx-dashboard-deliveries__client">{buildDisplayName(item.job_order) || '—'}</td>
                        <td className="dx-dashboard-deliveries__route" title={routeLabel}>
                          <span className="dx-table-route">{routeLabel}</span>
                        </td>
                        <td>
                          <span className={priorityCls} style={{ textTransform: 'capitalize' }}>{priority}</span>
                        </td>
                        <td className="dx-dashboard-deliveries__status"><StatusBadge status={item.status} /></td>
                        <td className="dx-dashboard-deliveries__arrival" style={{ color: arrivedLog?.arrival_verified ? '#166534' : 'var(--muted)' }}>
                          {arrivedLog?.arrival_verified
                            ? `GPS Verified${formatEventAt(arrivedLog, undefined, { hour: 'numeric', minute: '2-digit' }) ? ` · ${formatEventAt(arrivedLog, undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}`
                            : item.status === 'arrived' || item.status === 'arrived_at_destination' || item.status === 'completed' ? 'Not verified' : '—'}
                        </td>
                        <td className="dx-dashboard-deliveries__delay" style={{ color: delay ? '#991b1b' : isPastDue ? 'var(--color-warning)' : 'var(--muted)' }}>
                          {delay ? getDelayReasonLabel(delay.delay_reason) : isPastDue ? 'Past due (no reason)' : '—'}
                        </td>
                        <td className="dx-dashboard-deliveries__driver">{item.driver?.user?.name ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quick Actions" className="dispatcher-dashboard__actions">
          <div className="dispatcher-dashboard__action-list">
            {[
              { label: 'Create Job Order', to: '/dispatcher/job-orders', cls: 'btn-dx-primary' },
              { label: 'Fleet Dispatch', to: '/dispatcher/dispatch', cls: 'btn-dx-secondary' },
              { label: 'Calendar', to: '/dispatcher/calendar', cls: 'btn-dx-secondary' },
              { label: 'OCR Review', to: '/dispatcher/ocr-review', cls: 'btn-dx-secondary' },
              { label: 'Tracking', to: '/dispatcher/live-tracking', cls: 'btn-dx-secondary' },
            ].map(({ label, to, cls }) => (
              <Link key={to} to={to} className={`${cls} btn-sm dispatcher-dashboard__action-btn`}>
                {label}
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="dispatcher-dashboard__feed">
        <AssignmentAuditSection title="Recent Assignment Decisions" />
        <IssueReportsSection title="Recent Driver Issue Reports" />
      </div>
    </div>
  )
}

export default DispatcherDashboard
