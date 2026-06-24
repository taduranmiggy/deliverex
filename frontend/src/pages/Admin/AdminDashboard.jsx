import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAuditLogs, fetchDrivers, fetchOcrQueue, fetchUsers, fetchVehicles } from '../../api/admin'
import AssignmentAuditSection from '../../components/AssignmentAuditSection'
import { EmptyState, PageHeader, SectionCard, StatCard } from '../../components/ui'
import { Car, ChevronRight, Code, FileSearch, Users } from 'lucide-react'

function AdminDashboard() {
  const [summary, setSummary]   = useState({ users: 0, drivers: 0, vehicles: 0, ocr: 0 })
  const [activity, setActivity] = useState([])
  const [error, setError]       = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [users, drivers, vehicles, ocr, logs] = await Promise.all([
          fetchUsers(1),
          fetchDrivers(1),
          fetchVehicles(1),
          fetchOcrQueue(1, 'waiting'),
          fetchAuditLogs({ per_page: 8 }).catch(() => ({ data: [] })),
        ])
        setSummary({
          users:    users.total    ?? users.data?.length    ?? 0,
          drivers:  drivers.total  ?? drivers.data?.length  ?? 0,
          vehicles: vehicles.total ?? vehicles.data?.length ?? 0,
          ocr:      ocr.total      ?? ocr.data?.length      ?? 0,
        })
        setActivity(logs.data || [])
      } catch (err) { setError(err.message) }
    }
    load()
  }, [])

  const MODULE_COLORS = {
    'Auth': 'var(--color-info)', 'Job Orders': 'var(--color-primary)',
    'Dispatch': 'var(--color-warning)', 'OCR Validation': 'var(--color-purple)',
    'Delivery': 'var(--color-success)', 'Inquiries': 'var(--color-orange)',
  }

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="System Overview and Activity Monitoring" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <StatCard label="Docs Awaiting Review" value={summary.ocr}   icon={FileSearch} iconVariant={summary.ocr > 0 ? 'yellow' : 'green'} />
        <StatCard label="Total Users"          value={summary.users}    icon={Users}      iconVariant="default" />
        <StatCard label="Active Drivers"       value={summary.drivers}  icon={Users}      iconVariant="green" />
        <StatCard label="Fleet Vehicles"       value={summary.vehicles} icon={Car}        iconVariant="purple" />
      </div>

      <div className="admin-dashboard-grid">
        <SectionCard title="Recent System Activity">
          {activity.length === 0 ? (
            <EmptyState icon={Code} title="No activity recorded" message="Audit entries will appear here as actions are taken." />
          ) : (
            activity.map((log) => (
              <div key={log.id} className="dx-activity-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: MODULE_COLORS[log.module] ?? 'var(--muted)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>
                      {log.action.replace(/\./g, ' › ')}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {log.details}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p className="dx-activity-time">{log.user ?? 'System'}</p>
                  <p className="dx-activity-time">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</p>
                </div>
              </div>
            ))
          )}
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Quick Navigation">
            <nav aria-label="Admin quick navigation">
              {[
                { label: 'OCR Validation Queue',  to: '/admin/ocr-validation', count: summary.ocr,   urgent: summary.ocr > 0, hint: 'Review scanned documents' },
                { label: 'Job Orders',             to: '/admin/job-orders',     count: null,          hint: 'View and monitor orders' },
                { label: 'Manage Users & Roles',   to: '/admin/users',          count: summary.users, hint: 'Accounts and permissions' },
                { label: 'Master Data',            to: '/admin/master-data',    count: null,          hint: 'Clients, vehicles, quarries' },
                { label: 'Audit Logs',             to: '/admin/audit-logs',     count: null,          hint: 'System activity history' },
                { label: 'Chatbot Management',     to: '/admin/chatbot',        count: null,          hint: 'AI assistant configuration' },
                { label: 'Notifications',          to: '/admin/notifications',  count: null,          hint: 'System alerts and messages' },
              ].map(({ label, to, count, urgent, hint }) => (
                <Link
                  key={to}
                  to={to}
                  className="dx-quicknav-item"
                  aria-label={label}
                >
                  <div className="dx-quicknav-item__body">
                    <span className="dx-quicknav-item__label">{label}</span>
                    {hint && <span className="dx-quicknav-item__hint">{hint}</span>}
                  </div>
                  <div className="dx-quicknav-item__right">
                    {count != null && (
                      <span className={`dx-quicknav-badge${urgent ? ' dx-quicknav-badge--urgent' : ''}`}>
                        {count}
                      </span>
                    )}
                    <ChevronRight size={15} className="dx-quicknav-item__arrow" aria-hidden />
                  </div>
                </Link>
              ))}
            </nav>
          </SectionCard>
        </div>
      </div>

      <AssignmentAuditSection title="Assignment Audit Trail" hideWhenEmpty />
    </>
  )
}

export default AdminDashboard
