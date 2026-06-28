import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

function CustomerActionCard({ icon: Icon, title, description, to, onClick }) {
  const inner = (
    <>
      <div className="pwa-action-card__icon" aria-hidden>
        <Icon size={26} strokeWidth={2} />
      </div>
      <div className="pwa-action-card__body">
        <p className="pwa-action-card__title">{title}</p>
        {description ? <p className="pwa-action-card__desc">{description}</p> : null}
      </div>
      <ChevronRight size={16} className="pwa-action-card__chevron" aria-hidden />
    </>
  )

  const className = 'pwa-action-card pwa-action-card--app'

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
