import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

function CustomerActionCard({ icon: Icon, title, description, to, onClick }) {
  const inner = (
    <>
      <div className="pwa-action-card__icon">
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="pwa-action-card__body">
        <p className="pwa-action-card__title">{title}</p>
        {description ? <p className="pwa-action-card__desc">{description}</p> : null}
      </div>
      <ChevronRight size={18} className="pwa-action-card__chevron" aria-hidden />
    </>
  )

  if (to) {
    return (
      <Link to={to} className="pwa-action-card">
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" className="pwa-action-card" onClick={onClick}>
      {inner}
    </button>
  )
}

export default CustomerActionCard
