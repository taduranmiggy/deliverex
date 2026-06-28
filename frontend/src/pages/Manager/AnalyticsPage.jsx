import { useCallback, useEffect, useState } from 'react'
import { fetchAnalytics } from '../../api/manager'
import { DataTable, EmptyState, FilterSelect, PageHeader, SectionCard, StatCard, StatusBadge } from '../../components/ui'
import { AlertTriangle, BarChart3, Car, CheckCircle2, Clock, TrendingDown, Truck, Users } from 'lucide-react'

function BarChart({ data, labelKey = 'date', color = 'linear-gradient(180deg, #3b82f6, #1e40af)', formatLabel }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>No data for selected period.</p>
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, paddingBottom: 28, position: 'relative' }}>
      {data.map((d) => {
        const label = formatLabel ? formatLabel(d[labelKey]) : (
          labelKey === 'date'
            ? new Date(d[labelKey]).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
            : d[labelKey]
        )
        return (
        <div key={d[labelKey]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
          <div title={`${d.count} — ${label}`} style={{ width: '100%', minHeight: 4, height: `${Math.max(4, Math.round((d.count / max) * 88))}px`, background: color, borderRadius: '4px 4px 0 0' }} />
          <span style={{ position: 'absolute', bottom: 0, fontSize: '0.65rem', color: 'var(--muted)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
        </div>
        )
      })}
    </div>
  )
}

function ReasonList({ items }) {
  if (!items?.length) return <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>No delay reports for selected period.</p>
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
        <div key={item.reason}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{item.label}</span>
            <span style={{ color: 'var(--muted)' }}>{item.count}</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--slate-200)' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${Math.round((item.count / max) * 100)}%`, background: 'linear-gradient(90deg, #f97316, #dc2626)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AnalyticsPage() {
  const today = new Date()
  const [from, setFrom]     = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo]         = useState(today.toISOString().slice(0, 10))
  const [status, setStatus] = useState('')
  const [data, setData]     = useState(null)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (params) => {
    setLoading(true); setError('')
    try { setData(await fetchAnalytics(params)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load({ from, to }) }, []) // eslint-disable-line

  const s = data?.summary ?? {}
  const fleet = data?.fleet ?? {}
  const drivers = data?.drivers ?? []
  const delays = data?.delays ?? {}
  const driverDelayRates = delays.driver_delay_rates ?? []
  const vehicleDelayRates = delays.vehicle_delay_rates ?? []

  return (
    <>
      <PageHeader title="Analytics" subtitle="Deep insights into operations" />
      {error && <p className="notice error">{error}</p>}

      {/* Filters */}
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
          onClick={() => load({ from, to, status: status || undefined })} disabled={loading}>
          {loading ? 'Loading…' : 'Apply Filters'}
        </button>
      </div>

      {/* Summary stats */}
      <div className="dx-stat-row">
        <StatCard label="Total Jobs"    value={s.total      ?? '—'} icon={BarChart3}     iconVariant="default" />
        <StatCard label="Completed"     value={s.completed  ?? '—'} icon={CheckCircle2}  iconVariant="green" />
        <StatCard label="In Progress"   value={s.in_progress ?? '—'} icon={Clock}        iconVariant="purple" />
        <StatCard label="Delayed"       value={s.delayed    ?? '—'} icon={TrendingDown}  iconVariant={s.delayed > 0 ? 'red' : 'green'} />
        <StatCard label="Fleet Util."   value={fleet.utilization_pct != null ? `${fleet.utilization_pct}%` : '—'} icon={Car} iconVariant="orange" />
      </div>

      <div className="dx-grid-sidebar" style={{ marginBottom: 20 }}>
        <SectionCard title="Daily Completed Deliveries">
          <BarChart data={data?.daily_stats} />
        </SectionCard>
        <SectionCard title="Fleet Overview">
          {[
            { label: 'Available',   value: fleet.available,    color: 'var(--color-success)' },
            { label: 'Assigned',    value: fleet.assigned,     color: 'var(--color-primary)' },
            { label: 'Maintenance', value: fleet.maintenance,  color: 'var(--color-warning)' },
            { label: 'Total',       value: fleet.total,        color: 'var(--muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--stroke)', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              <strong style={{ color }}>{value ?? '—'}</strong>
            </div>
          ))}
        </SectionCard>
      </div>

      <div className="dx-stat-row" style={{ marginBottom: 20 }}>
        <StatCard label="Delay Reports" value={delays.total_reports ?? '—'} icon={AlertTriangle} iconVariant={delays.total_reports > 0 ? 'red' : 'green'} />
      </div>

      <div className="dx-grid-2" style={{ marginBottom: 20 }}>
        <SectionCard title="Most Common Delay Reasons">
          <ReasonList items={delays.common_reasons} />
        </SectionCard>
        <SectionCard title="Monthly Delay Trends">
          <BarChart
            data={delays.monthly_trends}
            labelKey="month"
            color="linear-gradient(180deg, #f97316, #c2410c)"
            formatLabel={(month) => {
              const [y, m] = month.split('-')
              return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
            }}
          />
        </SectionCard>
      </div>

      <div className="dx-grid-2" style={{ marginBottom: 20 }}>
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
                    <span style={{ fontWeight: 700, color: d.delay_rate_pct > 20 ? 'var(--color-error)' : d.delay_rate_pct > 10 ? 'var(--color-warning)' : 'var(--color-success)' }}>
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
                    <span style={{ fontWeight: 700, color: v.delay_rate_pct > 20 ? 'var(--color-error)' : v.delay_rate_pct > 10 ? 'var(--color-warning)' : 'var(--color-success)' }}>
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
          headers={['Driver', 'Total Jobs', 'Completed', 'On-Time Rate', 'Availability']}
          loading={loading}
          empty={<EmptyState icon={Users} title="No driver data" message="No drivers found for the selected period." />}
        >
          {drivers.length > 0 && drivers.map((d) => (
            <tr key={d.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="topbar-avatar" style={{ width: 30, height: 30, fontSize: '0.7rem', borderRadius: 8 }}>
                    {d.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600 }}>{d.name}</span>
                </div>
              </td>
              <td>{d.total}</td>
              <td>{d.completed}</td>
              <td>
                {d.on_time_pct != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--slate-200)', maxWidth: 80 }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${d.on_time_pct}%`, background: d.on_time_pct >= 90 ? 'var(--color-success)' : d.on_time_pct >= 75 ? 'var(--color-warning)' : 'var(--color-error)' }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{d.on_time_pct}%</span>
                  </div>
                ) : '—'}
              </td>
              <td><StatusBadge status={d.availability} /></td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>
    </>
  )
}

export default AnalyticsPage
