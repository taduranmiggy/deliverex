import { useEffect, useState } from 'react'
import { fetchManagerDashboard } from '../../api/manager'
import AssignmentAuditSection from '../../components/AssignmentAuditSection'
import DriverPerformanceSection from '../../components/DriverPerformanceSection'
import IssueReportsSection from '../../components/IssueReportsSection'
import VehicleUtilizationSection from '../../components/VehicleUtilizationSection'
import { PageHeader, SectionCard, StatCard } from '../../components/ui'
import { AlertTriangle, Car, CheckCircle2, Clock, TrendingUp, Truck, Users } from 'lucide-react'

function MiniBarChart({ data }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>No data yet.</p>
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, paddingBottom: 24, position: 'relative' }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div
            title={`${d.count} deliveries on ${d.label}`}
            style={{ width: '100%', minHeight: 6, height: `${Math.max(6, Math.round((d.count / max) * 76))}px`, background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }}
          />
          <span style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--muted)', position: 'absolute', bottom: 0 }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function ManagerDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchManagerDashboard()
      .then((res) => setStats(res))
      .catch((err) => setError(err.message))
  }, [])

  const s = stats ?? {}

  return (
    <>
      <PageHeader title="Manager Dashboard" subtitle="Analytics and performance overview" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <StatCard label="Total Job Orders"   value={s.job_orders          ?? '—'} icon={Truck}         iconVariant="default" />
        <StatCard label="Completed"          value={s.jobs_completed       ?? '—'} icon={CheckCircle2}  iconVariant="green" />
        <StatCard label="Active Deliveries"  value={s.assignments_active   ?? '—'} icon={Clock}         iconVariant="purple" />
        <StatCard label="Delayed"            value={s.delayed_today        ?? '—'} icon={AlertTriangle} iconVariant={s.delayed_today > 0 ? 'red' : 'green'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <SectionCard title="Completed Deliveries — Last 7 days">
          {stats ? (
            <>
              <MiniBarChart data={s.daily_completed} />
              <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 4 }}>
                <strong style={{ color: 'var(--text)' }}>{s.completed_this_week ?? 0}</strong> completed this week
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading…</p>
          )}
        </SectionCard>

        <SectionCard title="Fleet & Workforce">
          {[
            { label: 'On-Time Rate (this month)', value: s.on_time_pct != null ? `${s.on_time_pct}%` : '—', icon: TrendingUp, color: 'var(--color-success)' },
            { label: 'Drivers Available',         value: s.drivers_available  ?? '—', icon: Users, color: 'var(--color-primary)' },
            { label: 'Vehicles Available',        value: s.vehicles_available ?? '—', icon: Car,   color: 'var(--color-purple)' },
            { label: 'Pending Jobs',              value: s.jobs_pending       ?? '—', icon: Clock, color: 'var(--color-warning)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--stroke)', fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                <Icon size={15} style={{ color }} /> {label}
              </span>
              <strong style={{ fontSize: '1.0625rem' }}>{value}</strong>
            </div>
          ))}
        </SectionCard>
      </div>

      <VehicleUtilizationSection />

      <AssignmentAuditSection title="Assignment Audit History" />

      <IssueReportsSection title="Operational Issue Reports" />

      <DriverPerformanceSection />
    </>
  )
}

export default ManagerDashboard
