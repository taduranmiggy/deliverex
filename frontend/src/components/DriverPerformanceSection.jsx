import { useEffect, useState } from 'react'
import { fetchDriverPerformance } from '../api/driverPerformance'
import { EmptyState, SectionCard } from './ui'
import { Award, TrendingDown, Users } from 'lucide-react'

function scoreColor(score) {
  if (score >= 90) return 'var(--color-success)'
  if (score >= 75) return 'var(--color-primary)'
  if (score >= 60) return 'var(--color-warning)'
  return 'var(--color-error)'
}

function DriverScoreCard({ driver, rank }) {
  const b = driver.breakdown ?? {}
  const score = driver.reliability_score ?? 0

  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--stroke)', background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {rank != null && (
          <span style={{
            width: 28, height: 28, borderRadius: 8, background: 'var(--slate-100)',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.8125rem', color: 'var(--muted)',
          }}>
            {rank}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, margin: 0, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {driver.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
            {b.completed_deliveries ?? 0} completed · {b.failed_deliveries ?? 0} failed
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>/ 100</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: '0.75rem' }}>
        <div>
          <span style={{ color: 'var(--muted)' }}>On-Time</span>
          <strong style={{ display: 'block' }}>{b.on_time_pct != null ? `${b.on_time_pct}%` : '—'}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--muted)' }}>Delays</span>
          <strong style={{ display: 'block' }}>{b.delay_rate_pct ?? 0}%</strong>
        </div>
        <div>
          <span style={{ color: 'var(--muted)' }}>OCR Accuracy</span>
          <strong style={{ display: 'block' }}>{b.ocr_accuracy_pct ?? 100}%</strong>
        </div>
      </div>
      {(b.issue_reports ?? 0) > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
          {b.issue_reports} issue report{b.issue_reports > 1 ? 's' : ''} in period
        </p>
      )}
    </div>
  )
}

function DriverPerformanceSection({ limit = 5 }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDriverPerformance({ limit })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [limit])

  const top = data?.top_performers ?? []
  const low = data?.lowest_performers ?? []

  if (error) {
    return <p className="notice error">{error}</p>
  }

  return (
    <div className="admin-driver-performance-grid">
      <SectionCard title="Top Performing Drivers" action={<Award size={16} color="var(--color-success)" />}>
        {!data ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading scores…</p>
        ) : top.length === 0 ? (
          <EmptyState icon={Users} title="No scored drivers" message="Driver scores appear after assignments in the last 30 days." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {top.map((driver, i) => (
              <DriverScoreCard key={driver.id} driver={driver} rank={i + 1} />
            ))}
          </div>
        )}
        {data?.period && (
          <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--muted)' }}>
            Scores based on {data.period.from} – {data.period.to}
          </p>
        )}
      </SectionCard>

      <SectionCard title="Lowest Performing Drivers" action={<TrendingDown size={16} color="var(--color-warning)" />}>
        {!data ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading scores…</p>
        ) : low.length === 0 ? (
          <EmptyState icon={Users} title="No scored drivers" message="Driver scores appear after assignments in the last 30 days." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {low.map((driver, i) => (
              <DriverScoreCard key={driver.id} driver={driver} rank={i + 1} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

export default DriverPerformanceSection
