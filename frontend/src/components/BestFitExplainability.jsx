import { CheckCircle2, XCircle } from 'lucide-react'

function formatScore(candidate) {
  const score = candidate?.score
  const max = candidate?.score_max ?? 100
  if (score == null) return null
  return `${Math.round(score)}/${max}`
}

function BestFitExplainability({ candidate, compact = false }) {
  if (!candidate) return null

  const scoreLabel = formatScore(candidate)
  const factors = Array.isArray(candidate.factors) ? candidate.factors : []

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
      {scoreLabel && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: factors.length ? 14 : 0 }}>
          <span style={{ fontSize: compact ? '0.8125rem' : '0.875rem', fontWeight: 700, color: 'var(--muted)' }}>Score</span>
          <span style={{ fontSize: compact ? '1.125rem' : '1.5rem', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
            {scoreLabel}
          </span>
        </div>
      )}

      {factors.length > 0 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
            Reason Breakdown
          </p>
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
