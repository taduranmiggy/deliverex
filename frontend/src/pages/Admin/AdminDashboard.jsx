import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAuditLogs, fetchDrivers, fetchOcrQueue, fetchUsers, fetchVehicles } from '../../api/admin'
import AssignmentAuditSection from '../../components/AssignmentAuditSection'
import DriverPerformanceSection from '../../components/DriverPerformanceSection'
import { EmptyState, LoadingSpinner, PageHeader, PaginationBar, SectionCard, StatCard } from '../../components/ui'
import { ArrowDown, ArrowUp, Car, ChevronRight, Code, FileSearch, Users } from 'lucide-react'
import { normalizeOcrModuleLabel } from '../../utils/displayLabels'

const MODULE_COLORS = {
  Auth: 'var(--color-info)',
  'Job Orders': 'var(--color-primary)',
  Dispatch: 'var(--color-warning)',
  'OCR Review': 'var(--color-purple)',
  'OCR Validation': 'var(--color-purple)',
  Delivery: 'var(--color-success)',
  Inquiries: 'var(--color-orange)',
  System: 'var(--muted)',
}

const ACTIVITY_PER_PAGE = 6

function AdminDashboard() {
  const [summary, setSummary] = useState({ users: 0, drivers: 0, vehicles: 0, ocr: 0 })
  const [activity, setActivity] = useState([])
  const [activityMeta, setActivityMeta] = useState({ current_page: 1, per_page: ACTIVITY_PER_PAGE, total: 0 })
  const [activityPage, setActivityPage] = useState(1)
  const activityPerPage = ACTIVITY_PER_PAGE
  const [activitySort, setActivitySort] = useState('desc')
  const [activityLoading, setActivityLoading] = useState(false)
  const [error, setError] = useState('')

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await fetchAuditLogs({
        page: activityPage,
        per_page: activityPerPage,
        sort: activitySort,
      })
      setActivity(res.data || [])
      setActivityMeta({
        current_page: res.current_page || 1,
        per_page: res.per_page || activityPerPage,
        total: res.total || 0,
      })
    } catch {
      setActivity([])
      setActivityMeta((m) => ({ ...m, total: 0 }))
    } finally {
      setActivityLoading(false)
    }
  }, [activityPage, activityPerPage, activitySort])

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [users, drivers, vehicles, ocr] = await Promise.all([
          fetchUsers(1),
          fetchDrivers(1),
          fetchVehicles(1),
          fetchOcrQueue(1, 'waiting'),
        ])
        setSummary({
          users: users.total ?? users.data?.length ?? 0,
          drivers: drivers.total ?? drivers.data?.length ?? 0,
          vehicles: vehicles.total ?? vehicles.data?.length ?? 0,
          ocr: ocr.total ?? ocr.data?.length ?? 0,
        })
      } catch (err) {
        setError(err.message)
      }
    }
    loadSummary()
  }, [])

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  const handleActivitySort = (dir) => {
    setActivitySort(dir)
    setActivityPage(1)
  }

  return (
    <div className="admin-dashboard-page">
      <PageHeader title="Admin Dashboard" subtitle="System Overview and Activity Monitoring" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row admin-dashboard-stats">
        <StatCard label="Docs Awaiting Review" value={summary.ocr} icon={FileSearch} iconVariant={summary.ocr > 0 ? 'yellow' : 'green'} />
        <StatCard label="Total Users" value={summary.users} icon={Users} iconVariant="default" />
        <StatCard label="Active Drivers" value={summary.drivers} icon={Users} iconVariant="green" />
        <StatCard label="Fleet Vehicles" value={summary.vehicles} icon={Car} iconVariant="purple" />
      </div>

      <div className="admin-dashboard-grid">
        <SectionCard
          title="Recent System Activity"
          action={(
            <div className="dx-activity-toolbar">
              <span className="dx-activity-toolbar__label">Sort</span>
              <button
                type="button"
                className={`btn-dx-secondary btn-sm${activitySort === 'desc' ? ' dx-activity-toolbar__btn--active' : ''}`}
                onClick={() => handleActivitySort('desc')}
                title="Newest first"
              >
                <ArrowDown size={13} /> Newest
              </button>
              <button
                type="button"
                className={`btn-dx-secondary btn-sm${activitySort === 'asc' ? ' dx-activity-toolbar__btn--active' : ''}`}
                onClick={() => handleActivitySort('asc')}
                title="Oldest first"
              >
                <ArrowUp size={13} /> Oldest
              </button>
              <Link to="/admin/audit-logs" className="btn-dx-secondary btn-sm dx-activity-toolbar__link">
                View all
              </Link>
            </div>
          )}
        >
          {activityLoading && activity.length === 0 ? (
            <LoadingSpinner label="Loading activity…" />
          ) : activity.length === 0 ? (
            <EmptyState icon={Code} title="No activity recorded" message="Audit entries will appear here as actions are taken." />
          ) : (
            <div className="dx-activity-list">
              {activity.map((log) => (
                <div key={log.id} className="dx-activity-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: MODULE_COLORS[normalizeOcrModuleLabel(log.module)] ?? MODULE_COLORS.System,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>
                        {log.action.replace(/\./g, ' › ')}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.details}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="dx-activity-time">{log.user ?? 'System'}</p>
                    <p className="dx-activity-time">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activityMeta.total > 0 && (
            <PaginationBar
              page={activityMeta.current_page}
              perPage={activityMeta.per_page}
              total={activityMeta.total}
              onPage={setActivityPage}
            />
          )}
        </SectionCard>

        <div className="admin-dashboard-quicknav">
          <SectionCard title="Quick Navigation">
            <nav aria-label="Admin quick navigation">
              {[
                { label: 'OCR Review Queue', to: '/admin/ocr-validation', count: summary.ocr, urgent: summary.ocr > 0, hint: 'Review scanned documents' },
                { label: 'Job Orders', to: '/admin/job-orders', count: null, hint: 'View and monitor orders' },
                { label: 'Manage Users & Roles', to: '/admin/users', count: summary.users, hint: 'Accounts and permissions' },
                { label: 'Master Data', to: '/admin/master-data', count: null, hint: 'Clients, vehicles, quarries' },
                { label: 'Audit Logs', to: '/admin/audit-logs', count: null, hint: 'System activity history' },
                { label: 'Chatbot Management', to: '/admin/chatbot', count: null, hint: 'AI assistant configuration' },
                { label: 'Notifications', to: '/admin/notifications', count: null, hint: 'System alerts and messages' },
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

      <div className="admin-dashboard-section">
        <AssignmentAuditSection title="Assignment Audit Trail" />
      </div>

      <div className="admin-dashboard-section">
        <DriverPerformanceSection />
      </div>
    </div>
  )
}

export default AdminDashboard
