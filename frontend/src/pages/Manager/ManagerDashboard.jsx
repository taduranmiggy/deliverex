import { useEffect, useState } from 'react'
import { fetchManagerDashboard } from '../../api/manager'
import AssignmentAuditSection from '../../components/AssignmentAuditSection'
import KpiCard, { KpiCardSkeleton } from '../../components/analytics/KpiCard'
import DriverPerformanceSection from '../../components/DriverPerformanceSection'
import IssueReportsSection from '../../components/IssueReportsSection'
import VehicleUtilizationSection from '../../components/VehicleUtilizationSection'
import { PageHeader, SectionCard, StatCard } from '../../components/ui'
import { formatHours, formatPct, formatScore, formatTrend, hasChartData } from '../../utils/formatMetrics'
import {
  AlertTriangle, Car, CheckCircle2, Clock, FileCheck, Target, Timer,
  TrendingUp, Truck, Users, Zap,
} from 'lucide-react'

function WeeklyDeliveriesChart({ data }) {
  if (!hasChartData(data)) {
    return <p className="dx-weekly-chart__empty">No completed deliveries for this period.</p>
  }

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="dx-weekly-chart" role="img" aria-label="Completed deliveries for the last 7 days">
      {data.map((d) => (
        <div key={d.date} className="dx-weekly-chart__col">
          <div className="dx-weekly-chart__bar-wrap">
            <div
              className="dx-weekly-chart__bar"
              title={`${d.count} completed on ${d.label}`}
              style={{ height: `${Math.max(8, Math.round((d.count / max) * 100))}%` }}
            />
          </div>
          <span className="dx-weekly-chart__label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

const PERFORMANCE_KPIS = [
  {
    key: 'on_time_pct',
    trendKey: 'on_time_pct_trend',
    label: 'On-Time Delivery Rate',
    description: 'Completed on or before scheduled end',
    icon: TrendingUp,
    iconVariant: 'green',
    format: formatPct,
  },
  {
    key: 'delivery_completion_pct',
    trendKey: 'delivery_completion_pct_trend',
    label: 'Delivery Completion Rate',
    description: 'Completed job orders vs total created',
    icon: CheckCircle2,
    iconVariant: 'green',
    format: formatPct,
  },
  {
    key: 'avg_delivery_time_hours',
    trendKey: 'avg_delivery_time_hours_trend',
    label: 'Average Delivery Time',
    description: 'Dispatch to completion (hours)',
    icon: Timer,
    iconVariant: 'purple',
    format: formatHours,
    trendInvert: true,
    trendSuffix: ' hrs',
  },
  {
    key: 'driver_utilization_pct',
    trendKey: 'driver_utilization_pct_trend',
    label: 'Driver Utilization',
    description: 'Drivers with assignments vs available',
    icon: Users,
    iconVariant: 'default',
    format: formatPct,
  },
  {
    key: 'best_fit_efficiency_score',
    trendKey: 'best_fit_efficiency_score_trend',
    label: 'Best-Fit Efficiency',
    description: 'Average score of accepted dispatches',
    icon: Target,
    iconVariant: 'orange',
    format: formatScore,
    trendSuffix: ' pts',
  },
  {
    key: 'pod_completion_pct',
    trendKey: 'pod_completion_pct_trend',
    label: 'PoD Completion Rate',
    description: 'Completed deliveries with proof',
    icon: FileCheck,
    iconVariant: 'green',
    format: formatPct,
  },
  {
    key: 'exception_rate_pct',
    trendKey: 'exception_rate_pct_trend',
    label: 'Exception Rate',
    description: 'Delayed, cancelled, or failed deliveries',
    icon: Zap,
    iconVariant: 'yellow',
    format: formatPct,
    trendInvert: true,
  },
]

function ManagerDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchManagerDashboard()
      .then((res) => setStats(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const s = stats ?? {}
  const periodLabel = s.period
    ? `Last 30 days (${s.period.from} – ${s.period.to})`
    : 'Last 30 days'

  const exceptionVariant = s.exception_rate_pct > 10 ? 'red' : 'yellow'

  return (
    <>
      <PageHeader title="Manager Dashboard" subtitle="Analytics and performance overview" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <StatCard label="Total Job Orders" value={loading ? '…' : (s.job_orders ?? '—')} icon={Truck} iconVariant="default" />
        <StatCard label="Completed" value={loading ? '…' : (s.jobs_completed ?? '—')} icon={CheckCircle2} iconVariant="green" />
        <StatCard label="Active Deliveries" value={loading ? '…' : (s.assignments_active ?? '—')} icon={Clock} iconVariant="purple" />
        <StatCard
          label="Delayed"
          value={loading ? '…' : (s.delayed_today ?? '—')}
          icon={AlertTriangle}
          iconVariant={!loading && s.delayed_today > 0 ? 'red' : 'green'}
        />
      </div>

      <SectionCard title="Performance KPIs" className="dx-manager-kpi-section">
        <p className="dx-manager-kpi-section__period">{periodLabel}</p>
        <div className="dx-kpi-card-grid dx-kpi-card-grid--performance">
          {loading
            ? PERFORMANCE_KPIS.map(({ key }) => <KpiCardSkeleton key={key} />)
            : PERFORMANCE_KPIS.map((kpi) => {
                const raw = s[kpi.key]
                const iconVariant = kpi.key === 'exception_rate_pct' ? exceptionVariant : kpi.iconVariant

                return (
                  <KpiCard
                    key={kpi.key}
                    label={kpi.label}
                    rawValue={typeof raw === 'number' ? raw : null}
                    value={kpi.format(raw)}
                    formatValue={kpi.format}
                    description={kpi.description}
                    trend={formatTrend(s[kpi.trendKey], {
                      suffix: kpi.trendSuffix ?? '%',
                      invert: kpi.trendInvert ?? false,
                    })}
                    icon={kpi.icon}
                    iconVariant={iconVariant}
                  />
                )
              })}
        </div>
      </SectionCard>

      <div className="dx-grid-2" style={{ marginBottom: 20 }}>
        <SectionCard title="Completed Deliveries — Last 7 days">
          {loading ? (
            <KpiCardSkeleton />
          ) : (
            <>
              <WeeklyDeliveriesChart data={s.daily_completed} />
              <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 12 }}>
                <strong style={{ color: 'var(--text)' }}>{s.completed_this_week ?? 0}</strong> completed this week
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Fleet & Workforce">
          <div className="dx-fleet-snapshot">
            {[
              { label: 'Drivers Available', value: s.drivers_available ?? '—', icon: Users, color: 'var(--color-primary)' },
              { label: 'Vehicles Available', value: s.vehicles_available ?? '—', icon: Car, color: 'var(--color-purple)' },
              { label: 'Pending Jobs', value: s.jobs_pending ?? '—', icon: Clock, color: 'var(--color-warning)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="dx-fleet-snapshot__row">
                <span className="dx-fleet-snapshot__label">
                  <Icon size={15} style={{ color }} aria-hidden /> {label}
                </span>
                <strong className="dx-fleet-snapshot__value">{loading ? '…' : value}</strong>
              </div>
            ))}
          </div>
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
