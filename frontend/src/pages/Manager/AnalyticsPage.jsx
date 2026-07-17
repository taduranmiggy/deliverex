import { useCallback, useEffect, useState } from 'react'
import { fetchAnalytics } from '../../api/manager'
import {
  DailyDeliveriesChart,
  DelayReasonsChart,
  FleetStatusChart,
  JobStatusChart,
  MonthlyDelayTrendChart,
} from '../../components/analytics/AnalyticsCharts'
import { DataTable, EmptyState, FilterSelect, PageHeader, PaginationBar, SectionCard, StatCard, StatusBadge } from '../../components/ui'
import { formatPct } from '../../utils/formatMetrics'
import { AlertTriangle, Award, BarChart3, Car, CheckCircle2, Clock, TrendingDown, Truck, Users } from 'lucide-react'

function scoreColor(score) {
  if (score >= 90) return 'var(--color-success)'
  if (score >= 75) return 'var(--color-primary)'
  if (score >= 60) return 'var(--color-warning)'
  return 'var(--color-error)'
}

function rateColor(pct, invert = false) {
  if (pct == null) return 'var(--muted)'
  const good = invert ? pct <= 10 : pct >= 90
  const warn = invert ? pct <= 20 : pct >= 75
  if (good) return 'var(--color-success)'
  if (warn) return 'var(--color-warning)'
  return 'var(--color-error)'
}

function DriverRankCard({ driver, rank }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--stroke)', background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--slate-100)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.75rem', color: 'var(--muted)' }}>
          {rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driver.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
            {driver.completed ?? driver.breakdown?.completed_deliveries ?? 0} completed
          </p>
        </div>
        <strong style={{ fontSize: '1.25rem', color: scoreColor(driver.reliability_score ?? 0) }}>
          {driver.reliability_score ?? '—'}
        </strong>
      </div>
    </div>
  )
}

function AnalyticsPage() {
  const today = new Date()
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(today.toISOString().slice(0, 10))
  const [status, setStatus] = useState('')
  const [driversPage, setDriversPage] = useState(1)
  const driversPerPage = 6
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (params) => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchAnalytics(params))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ from, to, drivers_page: driversPage, drivers_per_page: driversPerPage })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (page = 1) => {
    setDriversPage(page)
    load({
      from,
      to,
      status: status || undefined,
      drivers_page: page,
      drivers_per_page: driversPerPage,
    })
  }

  const handleDriversPage = (page) => {
    setDriversPage(page)
    load({
      from,
      to,
      status: status || undefined,
      drivers_page: page,
      drivers_per_page: driversPerPage,
    })
  }

  const s = data?.summary ?? {}
  const fleet = data?.fleet ?? {}
  const drivers = data?.drivers ?? []
  const driversPagination = data?.drivers_pagination ?? { current_page: 1, per_page: driversPerPage, total: 0, last_page: 1 }
  const driverPerformance = data?.driver_performance ?? {}
  const delays = data?.delays ?? {}
  const driverDelayRates = delays.driver_delay_rates ?? []
  const vehicleDelayRates = delays.vehicle_delay_rates ?? []

  return (
    <>
      <PageHeader title="Analytics" subtitle="Deep insights into operations" />
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel dx-panel-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 20 }}>
        <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem' }}>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }} />
        </label>
        <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem' }}>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem' }} />
        </label>
        <FilterSelect value={status} onChange={setStatus} label="Status" options={[
          { value: '', label: 'All statuses' }, { value: 'completed', label: 'Completed' },
          { value: 'in_progress', label: 'In Progress' }, { value: 'pending', label: 'Pending' }, { value: 'cancelled', label: 'Cancelled' },
        ]} />
        <button type="button" className="btn-dx-primary" style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}
          onClick={() => applyFilters(1)} disabled={loading}>
          {loading ? 'Loading…' : 'Apply Filters'}
        </button>
      </div>

      <div className="dx-stat-row">
        <StatCard label="Total Jobs" value={loading ? '…' : (s.total ?? '—')} icon={BarChart3} iconVariant="default" />
        <StatCard label="Completed" value={loading ? '…' : (s.completed ?? '—')} icon={CheckCircle2} iconVariant="green" />
        <StatCard label="Completion Rate" value={loading ? '…' : formatPct(s.completion_rate_pct)} icon={Award} iconVariant="green" />
        <StatCard label="In Progress" value={loading ? '…' : (s.in_progress ?? '—')} icon={Clock} iconVariant="purple" />
        <StatCard label="Delayed" value={loading ? '…' : (s.delayed ?? '—')} icon={TrendingDown} iconVariant={!loading && s.delayed > 0 ? 'red' : 'green'} />
        <StatCard label="Fleet Util." value={loading ? '…' : formatPct(fleet.utilization_pct)} icon={Car} iconVariant="orange" />
      </div>

      <div className="dx-grid-2 dx-grid-2--start" style={{ marginBottom: 20 }}>
        <SectionCard title="Daily Completed Deliveries">
          <DailyDeliveriesChart data={data?.daily_stats} />
        </SectionCard>
        <SectionCard title="Job Status Breakdown">
          <JobStatusChart data={data?.charts?.job_status} />
        </SectionCard>
      </div>

      <div className="dx-grid-2 dx-grid-2--start" style={{ marginBottom: 20 }}>
        <SectionCard title="Fleet Status" className="dx-fleet-status-panel">
          <FleetStatusChart fleet={fleet} />
        </SectionCard>
        <SectionCard title="Top & Lowest Performers">
          <div className="dx-grid-2" style={{ gap: 16 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award size={14} /> Top performers
              </p>
              {(driverPerformance.top_performers ?? []).length === 0 ? (
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.8125rem' }}>No scored drivers in period.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {driverPerformance.top_performers.map((driver, i) => (
                    <DriverRankCard key={driver.id} driver={driver} rank={i + 1} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={14} /> Needs attention
              </p>
              {(driverPerformance.lowest_performers ?? []).length === 0 ? (
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.8125rem' }}>No scored drivers in period.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {driverPerformance.lowest_performers.map((driver, i) => (
                    <DriverRankCard key={driver.id} driver={driver} rank={i + 1} />
                  ))}
                </div>
              )}
            </div>
          </div>
          {driverPerformance.period && (
            <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--muted)' }}>
              Scores based on {driverPerformance.period.from} – {driverPerformance.period.to}
            </p>
          )}
        </SectionCard>
      </div>

      <div className="dx-stat-row dx-stat-row--compact" style={{ marginBottom: 20 }}>
        <StatCard label="Delay Reports" value={loading ? '…' : (delays.total_reports ?? '—')} icon={AlertTriangle} iconVariant={!loading && delays.total_reports > 0 ? 'red' : 'green'} />
      </div>

      <div className="dx-grid-2 dx-grid-2--start" style={{ marginBottom: 20 }}>
        <SectionCard title="Most Common Delay Reasons">
          <DelayReasonsChart items={delays.common_reasons} />
        </SectionCard>
        <SectionCard title="Monthly Delay Trends">
          <MonthlyDelayTrendChart data={delays.monthly_trends} />
        </SectionCard>
      </div>

      <div className="dx-grid-2 dx-grid-2--start" style={{ marginBottom: 20 }}>
        <SectionCard title="Delay Rate per Driver">
          <DataTable
            headers={['Driver', 'Assignments', 'Delay Reports', 'Delay Rate']}
            loading={loading}
            empty={<EmptyState icon={Users} title="No delay data" message="No driver delay rates for the selected period." />}
          >
            {driverDelayRates.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td>{d.total_assignments}</td>
                <td>{d.delay_reports}</td>
                <td>
                  {d.delay_rate_pct != null ? (
                    <span style={{ fontWeight: 700, color: rateColor(d.delay_rate_pct, true) }}>
                      {d.delay_rate_pct}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        <SectionCard title="Delay Rate per Vehicle">
          <DataTable
            headers={['Vehicle', 'Assignments', 'Delay Reports', 'Delay Rate']}
            loading={loading}
            empty={<EmptyState icon={Truck} title="No delay data" message="No vehicle delay rates for the selected period." />}
          >
            {vehicleDelayRates.map((v) => (
              <tr key={v.id}>
                <td>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{v.plate_no}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{v.type ?? '—'}</div>
                </td>
                <td>{v.total_assignments}</td>
                <td>{v.delay_reports}</td>
                <td>
                  {v.delay_rate_pct != null ? (
                    <span style={{ fontWeight: 700, color: rateColor(v.delay_rate_pct, true) }}>
                      {v.delay_rate_pct}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>

      <SectionCard title="Driver Performance">
        <DataTable
          headers={['Driver', 'Score', 'Total Jobs', 'Completed', 'Completion', 'On-Time', 'Delay Rate', 'OCR Accuracy', 'Availability']}
          loading={loading}
          empty={<EmptyState icon={Users} title="No driver data" message="No drivers with assignments found for the selected period." />}
        >
          {drivers.map((d) => (
            <tr key={d.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="topbar-avatar" style={{ width: 30, height: 30, fontSize: '0.7rem', borderRadius: 8 }}>
                    {d.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600 }}>{d.name}</span>
                </div>
              </td>
              <td>
                {d.reliability_score != null ? (
                  <strong style={{ color: scoreColor(d.reliability_score) }}>{d.reliability_score}</strong>
                ) : '—'}
              </td>
              <td>{d.total}</td>
              <td>{d.completed}</td>
              <td>
                {d.completion_pct != null ? (
                  <span style={{ fontWeight: 700, color: rateColor(d.completion_pct) }}>{d.completion_pct}%</span>
                ) : '—'}
              </td>
              <td>
                {d.on_time_pct != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--slate-200)', maxWidth: 72 }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${d.on_time_pct}%`, background: rateColor(d.on_time_pct) }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{d.on_time_pct}%</span>
                  </div>
                ) : '—'}
              </td>
              <td>
                {d.delay_rate_pct != null ? (
                  <span style={{ fontWeight: 700, color: rateColor(d.delay_rate_pct, true) }}>{d.delay_rate_pct}%</span>
                ) : '—'}
              </td>
              <td>
                {d.ocr_accuracy_pct != null ? (
                  <span style={{ fontWeight: 700, color: rateColor(d.ocr_accuracy_pct) }}>{d.ocr_accuracy_pct}%</span>
                ) : '—'}
              </td>
              <td><StatusBadge status={d.availability} /></td>
            </tr>
          ))}
        </DataTable>
        {driversPagination.total > 0 && (
          <PaginationBar
            page={driversPagination.current_page}
            perPage={driversPagination.per_page}
            total={driversPagination.total}
            onPage={handleDriversPage}
          />
        )}
      </SectionCard>
    </>
  )
}

export default AnalyticsPage
