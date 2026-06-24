import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import PageTransition from '../components/PageTransition'
import useAuth from '../hooks/useAuth'
import { Bell, Menu, X } from 'lucide-react'

const navCls = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`

/**
 * Shared admin / dispatcher / manager shell with mobile slide-in navigation.
 */
function StaffAppShell({
  roleLabel,
  brandIcon: BrandIcon,
  navItems,
  notificationPath,
}) {
  const { user } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : roleLabel.slice(0, 2).toUpperCase()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('dx-nav-locked', mobileNavOpen)
    return () => document.body.classList.remove('dx-nav-locked')
  }, [mobileNavOpen])

  return (
    <div className={`app-shell${mobileNavOpen ? ' app-shell--nav-open' : ''}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />

      <aside className={`sidebar sidebar--deliverex${mobileNavOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-icon" aria-hidden>
              <BrandIcon size={18} color="#fff" />
            </div>
            <div>
              <div className="brand">Deliverex</div>
              <div className="sidebar-role-label">{roleLabel}</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label={`${roleLabel} navigation`}>
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={navCls}
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon size={17} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="profile">
          <div className="sidebar-user">
            <div className="topbar-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            <div className="sidebar-user__info">
              <span className="sidebar-user__name">{user?.name ?? roleLabel}</span>
              <span className="sidebar-user__email" title={user?.email ?? ''}>
                {user?.email ?? ''}
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar-menu-btn"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="topbar-title" />
          <div className="topbar-actions">
            <NavLink to={notificationPath} className="topbar-icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </NavLink>
            <div className="topbar-avatar" title={user?.name}>{initials}</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}

export default StaffAppShell
