import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchAssignments, fetchJobOrders } from '../../api/dispatcher'
import AssignmentAuditSection from '../../components/AssignmentAuditSection'
import IssueReportsSection from '../../components/IssueReportsSection'
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from '../../components/ui'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, ListOrdered, MapPin, Truck } from 'lucide-react'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
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

  // ── KPI navigation shortcuts ──────────────────────────────────────────────
  const goJobs = (initialTab) => navigate('/dispatcher/job-orders', { state: { initialTab } })

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of dispatch operations" />
      {error && <p className="notice error">{error}</p>}

      {/* ── Primary KPI row ─────────────────────────────────────────────── */}
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

      {/* ── Secondary stat: Total Job Orders ──────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
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

      {/* ── Pending dispatch banner ──────────────────────────────────────── */}
      {summary.pending > 0 && (
        <div className="notice" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <span style={{ fontWeight: 600 }}>
            {summary.pending} job{summary.pending > 1 ? 's' : ''} awaiting assignment
          </span>
          <Link to="/dispatcher/dispatch" className="btn-dx-primary btn-sm">
            Dispatch now <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="dx-grid-sidebar">
        <SectionCard title="Active Deliveries"
          action={<Link to="/dispatcher/live-tracking" className="btn-dx-secondary btn-sm">View map →</Link>}
        >
          {deliveries.length === 0 ? (
            <EmptyState icon={Truck} title="No active deliveries" message="Assign jobs to see active deliveries here." />
          ) : (
            <div className="dx-data-table-wrap">
              <table className="dx-data-table">
                <thead><tr>
                  <th>Job ID</th><th>Client</th><th>Route</th><th>Priority</th><th>Status</th><th>Arrival</th><th>Delay Reason</th><th>Driver</th>
                </tr></thead>
                <tbody>
                  {deliveries.map((item) => {
                    const delay = item.latest_delay_report
                    const arrivedLog = item.latest_arrived_status_log
                    const isPastDue = item.job_order?.scheduled_end && new Date(item.job_order.scheduled_end).getTime() < Date.now()
                    return (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem' }}>{formatJobPublicId(item.job_order_id)}</td>
                      <td style={{ fontWeight: 600 }}>{buildDisplayName(item.job_order) || '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                        {buildDisplayAddress('pickup', item.job_order) || '—'} → {buildDisplayAddress('dropoff', item.job_order) || '—'}
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.8125rem', color: 'var(--muted)' }}>{item.job_order?.priority ?? '—'}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td style={{ fontSize: '0.8125rem', color: arrivedLog?.arrival_verified ? '#166534' : 'var(--muted)' }}>
                        {arrivedLog?.arrival_verified
                          ? `GPS Verified${formatEventAt(arrivedLog, undefined, { hour: 'numeric', minute: '2-digit' }) ? ` · ${formatEventAt(arrivedLog, undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}`
                          : item.status === 'arrived' || item.status === 'completed' ? 'Not verified' : '—'}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: delay ? '#991b1b' : isPastDue ? 'var(--color-warning)' : 'var(--muted)' }}>
                        {delay ? getDelayReasonLabel(delay.delay_reason) : isPastDue ? 'Past due (no reason)' : '—'}
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{item.driver?.user?.name ?? '—'}</td>
                    </tr>
                    )
                  })}
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
              { label: 'Fleet Dispatch',      to: '/dispatcher/dispatch', cls: 'btn-dx-secondary' },
              { label: 'Calendar',            to: '/dispatcher/calendar',          cls: 'btn-dx-secondary' },
              { label: 'OCR Review',          to: '/dispatcher/ocr-review',         cls: 'btn-dx-secondary' },
              { label: 'Tracking',            to: '/dispatcher/live-tracking',      cls: 'btn-dx-secondary' },
            ].map(({ label, to, cls }) => (
              <Link key={to} to={to} className={`${cls} btn-sm`} style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start', gap: 8 }}>
                {label}
              </Link>
            ))}
          </SectionCard>
        </div>
      </div>

      <AssignmentAuditSection title="Recent Assignment Decisions" />

      <IssueReportsSection title="Recent Driver Issue Reports" />
    </>
  )
}

export default DispatcherDashboard
