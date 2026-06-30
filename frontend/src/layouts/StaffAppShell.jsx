import { Suspense, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import StaffSidebar from '../components/layout/StaffSidebar'
import PageTransition from '../components/PageTransition'
import RouteFallback from '../components/RouteFallback'
import UserAccountMenu from '../components/UserAccountMenu'
import useAuth from '../hooks/useAuth'
import { Bell, Menu } from 'lucide-react'

function normalizeNavSections(navItems, navSections) {
  if (Array.isArray(navSections) && navSections.length > 0) {
    return navSections
  }
  if (Array.isArray(navItems) && navItems.length > 0) {
    return [{ label: 'Menu', items: navItems }]
  }
  return []
}

/**
 * Shared admin / dispatcher / manager shell with mobile slide-in navigation.
 */
function StaffAppShell({
  roleLabel,
  brandIcon,
  navItems,
  navSections,
  notificationPath,
  profilePath,
}) {
  const { user } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const sections = useMemo(
    () => normalizeNavSections(navItems, navSections),
    [navItems, navSections],
  )

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

      <StaffSidebar
        roleLabel={roleLabel}
        brandIcon={brandIcon}
        navSections={sections}
        user={user}
        profilePath={profilePath}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

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
            <UserAccountMenu profilePath={profilePath} />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          <PageTransition>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}

export default StaffAppShell
