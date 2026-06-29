import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const BADGE_VARIANTS = {
  blue: 'pwa-action-card__badge--blue',
  green: 'pwa-action-card__badge--green',
  purple: 'pwa-action-card__badge--purple',
  yellow: 'pwa-action-card__badge--yellow',
  red: 'pwa-action-card__badge--red',
}

function CustomerActionCard({
  icon: Icon,
  title,
  description,
  to,
  onClick,
  badge,
  badgeVariant = 'blue',
  layout = 'app',
}) {
  const isInline = layout === 'inline'

  const inner = isInline ? (
    <>
      <div className="pwa-action-card__icon" aria-hidden>
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="pwa-action-card__body">
        <p className="pwa-action-card__title">{title}</p>
        {description ? <p className="pwa-action-card__desc">{description}</p> : null}
      </div>
      <ChevronRight size={16} className="pwa-action-card__chevron" aria-hidden />
    </>
  ) : (
    <>
      <div className="pwa-action-card__top">
        <div className="pwa-action-card__icon" aria-hidden>
          <Icon size={26} strokeWidth={2} />
        </div>
        <ChevronRight size={16} className="pwa-action-card__chevron" aria-hidden />
      </div>
      <div className="pwa-action-card__body">
        <p className="pwa-action-card__title">{title}</p>
        {description ? <p className="pwa-action-card__desc">{description}</p> : null}
      </div>
      {badge ? (
        <span className={`pwa-action-card__badge ${BADGE_VARIANTS[badgeVariant] ?? BADGE_VARIANTS.blue}`}>
          {badge}
        </span>
      ) : null}
    </>
  )

  const className = `pwa-action-card${isInline ? ' pwa-action-card--inline' : ' pwa-action-card--app'}${badge ? ' pwa-action-card--badged' : ''}`

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  )
}

export default CustomerActionCard
