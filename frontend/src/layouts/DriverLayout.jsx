import { Suspense, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { DriverUiProvider } from '../context/DriverUiContext'
import { fetchNotifications } from '../api/notifications'
import '../styles/driver-app.css'
import { ArrowLeft, Bell, Briefcase, Camera, Home, Truck, User } from 'lucide-react'

const TABS = [
  { to: '/driver', end: true, icon: Home, label: 'Home' },
  { to: '/driver/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/driver/documents', icon: Camera, label: 'Upload' },
  { to: '/driver/notifications', icon: Bell, label: 'Alerts' },
  { to: '/driver/profile', icon: User, label: 'Profile' },
]

const PAGE_TITLES = {
  '/driver': 'Home',
  '/driver/jobs': 'Jobs',
  '/driver/documents': 'Upload',
  '/driver/notifications': 'Notifications',
  '/driver/profile': 'Profile',
}

function DriverLayoutInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  const isJobDetail = /^\/driver\/jobs\/[^/]+$/.test(location.pathname)
  const showBack = isJobDetail

  const headerTitle = useMemo(() => {
    if (isJobDetail) return 'Job Details'
    return PAGE_TITLES[location.pathname] ?? 'Deliverex'
  }, [location.pathname, isJobDetail])

  useEffect(() => {
    fetchNotifications(1)
      .then((res) => {
        const count = (res.data || []).filter((n) => !n.is_read).length
        setUnreadCount(count)
      })
      .catch(() => {})
  }, [location.pathname])

  const tabCls = ({ isActive }) => `driver-app-tab${isActive ? ' driver-app-tab--active' : ''}`

  return (
    <div className="driver-app-root">
      <div className="driver-app-frame">
        <header className="driver-app-header">
          {showBack ? (
            <button
              type="button"
              className="driver-app-header__back"
              aria-label="Go back"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <div className="driver-app-header__brand">
              <div className="driver-app-header__logo" aria-hidden>
                <Truck size={18} />
              </div>
            </div>
          )}
          <h1 className="driver-app-header__title">{headerTitle}</h1>
          <NavLink to="/driver/notifications" className="driver-app-header__notif" aria-label="Notifications">
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="driver-app-header__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </NavLink>
        </header>

        <main className="driver-app-main" id="main-content" tabIndex={-1}>
          <Suspense
            fallback={(
              <div className="driver-app-content">
                <div className="da-skeleton" style={{ minHeight: 140 }} />
                <div className="da-skeleton" />
                <div className="da-skeleton" />
              </div>
            )}
          >
            <div className="driver-app-content">
              <Outlet />
            </div>
          </Suspense>
        </main>

        <nav className="driver-app-tabbar" aria-label="Driver navigation">
          {TABS.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={tabCls}>
              <Icon size={22} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function DriverLayout() {
  return (
    <DriverUiProvider>
      <DriverLayoutInner />
    </DriverUiProvider>
  )
}

export default DriverLayout
