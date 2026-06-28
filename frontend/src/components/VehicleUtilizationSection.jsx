import { useEffect, useState } from 'react'
import { fetchVehicleUtilization } from '../api/vehicleUtilization'
import { EmptyState, SectionCard, StatCard } from './ui'
import { Car, TrendingDown, TrendingUp } from 'lucide-react'

function utilColor(pct) {
  if (pct >= 70) return 'var(--color-success)'
  if (pct >= 40) return 'var(--color-primary)'
  if (pct >= 20) return 'var(--color-warning)'
  return 'var(--color-error)'
}

function VehicleUtilCard({ vehicle, rank }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--stroke)', background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        {rank != null && (
          <span style={{
            width: 28, height: 28, borderRadius: 8, background: 'var(--slate-100)',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.8125rem', color: 'var(--muted)',
          }}>
            {rank}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, margin: 0, fontFamily: 'monospace', fontSize: '0.9375rem' }}>{vehicle.plate_no}</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>{vehicle.type}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: utilColor(vehicle.utilization_pct), lineHeight: 1 }}>
            {vehicle.utilization_pct}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>utilization</div>
        </div>
      </div>
      <div className="dx-grid-3" style={{ fontSize: '0.75rem' }}>
        <div>
          <span style={{ color: 'var(--muted)' }}>Trips</span>
          <strong style={{ display: 'block' }}>{vehicle.total_trips}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--muted)' }}>Hours</span>
          <strong style={{ display: 'block' }}>{vehicle.total_delivery_hours}h</strong>
        </div>
        <div>
          <span style={{ color: 'var(--muted)' }}>Active / Idle</span>
          <strong style={{ display: 'block' }}>{vehicle.active_days}d / {vehicle.idle_days}d</strong>
        </div>
      </div>
    </div>
  )
}

function VehicleUtilizationSection({ limit = 5 }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVehicleUtilization({ limit })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [limit])

  if (error) {
    return <p className="notice error">{error}</p>
  }

  const summary = data?.summary ?? {}
  const most = data?.most_utilized ?? []
  const least = data?.least_utilized ?? []

  return (
    <>
      <div className="dx-stat-row" style={{ marginBottom: 20 }}>
        <StatCard label="Fleet Utilization" value={summary.avg_utilization_pct != null ? `${summary.avg_utilization_pct}%` : '—'} icon={Car} iconVariant="orange" />
        <StatCard label="Total Trips" value={summary.total_trips ?? '—'} icon={TrendingUp} iconVariant="default" />
        <StatCard label="Total Delivery Hours" value={summary.total_delivery_hours != null ? `${summary.total_delivery_hours}h` : '—'} icon={Car} iconVariant="purple" hint="Fleet-wide sum, last 30 days" />
        <StatCard label="Fleet Vehicles" value={summary.total_vehicles ?? '—'} icon={Car} iconVariant="default" />
      </div>

      <div className="dx-grid-2" style={{ marginBottom: 20 }}>
        <SectionCard title="Most Utilized Vehicles" action={<TrendingUp size={16} color="var(--color-success)" />}>
          {!data ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : most.length === 0 ? (
            <EmptyState icon={Car} title="No trip data" message="Vehicle utilization appears after assignments in the last 30 days." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {most.map((v, i) => <VehicleUtilCard key={v.id} vehicle={v} rank={i + 1} />)}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Least Utilized Vehicles" action={<TrendingDown size={16} color="var(--color-warning)" />}>
          {!data ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : least.length === 0 ? (
            <EmptyState icon={Car} title="No fleet data" message="Add vehicles and assignments to see utilization." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {least.map((v, i) => <VehicleUtilCard key={v.id} vehicle={v} rank={i + 1} />)}
            </div>
          )}
        </SectionCard>
      </div>

      {data?.period && (
        <p style={{ margin: '0 0 20px', fontSize: '0.75rem', color: 'var(--muted)' }}>
          Fleet utilization for {data.period.from} – {data.period.to} ({data.period.days} days).
          Active days: {summary.active_days_fleet ?? 0} fleet-wide · Idle days: {summary.idle_days_fleet ?? 0} fleet-wide.
        </p>
      )}
    </>
  )
}

export default VehicleUtilizationSection
