import { NavLink } from 'react-router-dom'
import LogoutButton from '../LogoutButton'
import { X } from 'lucide-react'

const linkCls = ({ isActive }) => `dx-staff-sidebar__link${isActive ? ' dx-staff-sidebar__link--active' : ''}`

function StaffSidebar({
  roleLabel,
  brandIcon: BrandIcon,
  navSections,
  user,
  profilePath,
  open,
  onClose,
}) {
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : roleLabel.slice(0, 2).toUpperCase()

  return (
    <aside
      className={`dx-staff-sidebar${open ? ' dx-staff-sidebar--open' : ''}`}
      aria-label={`${roleLabel} sidebar`}
    >
      <header className="dx-staff-sidebar__header">
        <div className="dx-staff-sidebar__brand">
          <div className="dx-staff-sidebar__brand-icon" aria-hidden>
            <BrandIcon size={20} color="#fff" strokeWidth={2.25} />
          </div>
          <div className="dx-staff-sidebar__brand-text">
            <span className="dx-staff-sidebar__brand-name">Deliverex</span>
            <span className="dx-staff-sidebar__brand-role">{roleLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="dx-staff-sidebar__close"
          aria-label="Close menu"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>

      <div className="dx-staff-sidebar__nav">
        {navSections.map((section) => (
          <div key={section.label} className="dx-staff-sidebar__section">
            <p className="dx-staff-sidebar__section-label">{section.label}</p>
            <ul className="dx-staff-sidebar__list">
              {section.items.map(({ to, label, Icon, end, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={linkCls}
                    onClick={onClose}
                  >
                    <span className="dx-staff-sidebar__link-icon" aria-hidden>
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="dx-staff-sidebar__link-label">{label}</span>
                    {badge ? (
                      <span className="dx-staff-sidebar__link-badge">{badge}</span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="dx-staff-sidebar__footer">
        {profilePath ? (
          <NavLink to={profilePath} className="dx-staff-sidebar__user" onClick={onClose}>
            <div className="dx-staff-sidebar__avatar" aria-hidden>{initials}</div>
            <div className="dx-staff-sidebar__user-meta">
              <span className="dx-staff-sidebar__user-name">{user?.name ?? roleLabel}</span>
              <span className="dx-staff-sidebar__user-email" title={user?.email ?? ''}>
                {user?.email ?? ''}
              </span>
            </div>
          </NavLink>
        ) : (
          <div className="dx-staff-sidebar__user">
            <div className="dx-staff-sidebar__avatar" aria-hidden>{initials}</div>
            <div className="dx-staff-sidebar__user-meta">
              <span className="dx-staff-sidebar__user-name">{user?.name ?? roleLabel}</span>
              <span className="dx-staff-sidebar__user-email" title={user?.email ?? ''}>
                {user?.email ?? ''}
              </span>
            </div>
          </div>
        )}
        <LogoutButton />
      </footer>
    </aside>
  )
}

export default StaffSidebar
