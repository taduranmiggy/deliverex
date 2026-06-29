import { CheckCircle2, XCircle } from 'lucide-react'

function formatScore(candidate) {
  const score = candidate?.score
  const max = candidate?.score_max ?? 90
  if (score == null) return null
  return `${Math.round(score)}/${max}`
}

const VISIBLE_FACTOR_KEYS = new Set([
  'vehicle_capacity_match',
  'driver_available',
  'load_efficiency',
  'vehicle_type_match',
  'schedule_match',
])

function visibleFactors(candidate) {
  return (Array.isArray(candidate?.factors) ? candidate.factors : [])
    .filter((factor) => VISIBLE_FACTOR_KEYS.has(factor.key))
}

function BestFitExplainability({ candidate, compact = false }) {
  if (!candidate) return null

  const scoreLabel = formatScore(candidate)
  const factors = visibleFactors(candidate)

  if (!scoreLabel && factors.length === 0) return null

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--stroke)',
        background: compact ? 'transparent' : 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        padding: compact ? '12px 14px' : '16px 18px',
      }}
    >
      {factors.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
              Match Score Breakdown
            </p>
            {scoreLabel && (
              <span style={{ fontSize: compact ? '0.9375rem' : '1.125rem', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                {scoreLabel}
              </span>
            )}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10 }}>
            {factors.map((factor) => {
              const Icon = factor.matched ? CheckCircle2 : XCircle
              const iconColor = factor.matched ? 'var(--color-success)' : 'var(--color-error)'
              return (
                <li
                  key={factor.key}
                  title={factor.detail}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 1fr auto',
                    gap: 10,
                    alignItems: 'start',
                    fontSize: compact ? '0.8125rem' : '0.875rem',
                  }}
                >
                  <Icon size={16} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{factor.label}</div>
                    {!compact && factor.detail && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{factor.detail}</div>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, color: factor.matched ? 'var(--color-primary)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    +{factor.contribution}/{factor.max}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

export { formatScore }
export default BestFitExplainability
