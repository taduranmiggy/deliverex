import { useCallback, useEffect, useState } from 'react'
import { fetchAnalytics } from '../../api/manager'
import { DataTable, EmptyState, FilterSelect, PageHeader, SectionCard, StatCard, StatusBadge } from '../../components/ui'
import { BarChart3, Car, CheckCircle2, Clock, TrendingDown, Users } from 'lucide-react'

function BarChart({ data }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>No data for selected period.</p>
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, paddingBottom: 28, position: 'relative' }}>
      {data.map((d) => (
        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div title={`${d.count} on ${d.date}`} style={{ width: '100%', minHeight: 4, height: `${Math.max(4, Math.round((d.count / max) * 88))}px`, background: 'linear-gradient(180deg, #3b82f6, #1e40af)', borderRadius: '4px 4px 0 0' }} />
          <span style={{ position: 'absolute', bottom: 0, fontSize: '0.65rem', color: 'var(--muted)', transform: 'translateX(-50%)', left: '50%', whiteSpace: 'nowrap' }}>
            {new Date(d.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
          </span>
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

  return (
    <>
      <PageHeader title="Analytics" subtitle="Deep insights into operations" />
      {error && <p className="notice error">{error}</p>}

      {/* Filters */}
      <div className="dx-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 20 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 20 }}>
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
