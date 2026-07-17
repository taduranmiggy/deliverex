import { useEffect, useRef, useState } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

function TrendBadge({ trend }) {
  if (!trend) return null

  const Icon = trend.type === 'up' ? TrendingUp : trend.type === 'down' ? TrendingDown : Minus
  const cls = `dx-kpi-trend dx-kpi-trend--${trend.type}`

  return (
    <div className={cls}>
      <Icon size={12} aria-hidden />
      <span>{trend.text}</span>
    </div>
  )
}

function useAnimatedValue(target, animate) {
  const [display, setDisplay] = useState(target)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!animate || target == null || !Number.isFinite(Number(target))) {
      setDisplay(target)
      return undefined
    }

    const goal = Number(target)
    const start = Number.isFinite(Number(display)) ? Number(display) : 0
    const diff = goal - start
    const duration = 520
    const startTime = performance.now()

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(start + diff * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, animate]) // eslint-disable-line react-hooks/exhaustive-deps

  return display
}

export function KpiCardSkeleton() {
  return (
    <div className="dx-kpi-card dx-kpi-card--loading" aria-hidden>
      <div className="dx-kpi-card__skel-icon" />
      <div className="dx-kpi-card__body">
        <div className="dx-kpi-card__skel-line dx-kpi-card__skel-line--sm" />
        <div className="dx-kpi-card__skel-line dx-kpi-card__skel-line--lg" />
        <div className="dx-kpi-card__skel-line dx-kpi-card__skel-line--md" />
      </div>
    </div>
  )
}

export default function KpiCard({
  label,
  value,
  rawValue = null,
  formatValue,
  description,
  trend = null,
  icon: Icon,
  iconVariant = 'default',
  loading = false,
  animate = true,
}) {
  const animated = useAnimatedValue(rawValue, !loading && animate && rawValue != null)

  if (loading) return <KpiCardSkeleton />

  const displayValue = formatValue && rawValue != null && Number.isFinite(Number(animated))
    ? formatValue(animated)
    : value

  const iconClass = `dx-kpi-card__icon dx-kpi-card__icon--${iconVariant}`

  return (
    <article className="dx-kpi-card">
      {Icon && (
        <div className={iconClass} aria-hidden>
          <Icon size={20} />
        </div>
      )}
      <div className="dx-kpi-card__body">
        <h3 className="dx-kpi-card__label">{label}</h3>
        <p className="dx-kpi-card__value">{displayValue}</p>
        {description && <p className="dx-kpi-card__desc">{description}</p>}
        <TrendBadge trend={trend} />
      </div>
    </article>
  )
}
