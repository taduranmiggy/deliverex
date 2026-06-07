import { NavLink, Outlet } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import useAuth from '../hooks/useAuth'
import {
  Bell, Calendar, LayoutDashboard, Mail, Map, Route, Truck,
} from 'lucide-react'

const navCls = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`

const NAV = [
  { to: '/dispatcher',                   label: 'Dashboard',       Icon: LayoutDashboard, end: true },
  { to: '/dispatcher/job-orders',        label: 'Job Orders',      Icon: Truck },
  { to: '/dispatcher/dispatch-best-fit', label: 'Fleet Dispatch',  Icon: Route },
  { to: '/dispatcher/calendar',          label: 'Calendar',        Icon: Calendar },
  { to: '/dispatcher/live-tracking',     label: 'Tracking',        Icon: Map },
  { to: '/dispatcher/notifications',     label: 'Notifications',   Icon: Bell },
  { to: '/dispatcher/inquiries',         label: 'Inquiries',       Icon: Mail },
]

function DispatcherLayout() {
  const { user } = useAuth()
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DP'

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-icon" aria-hidden>
              <Route size={18} color="#fff" />
            </div>
            <div>
              <div className="brand">Deliverex</div>
              <div className="sidebar-role-label">Dispatcher</div>
            </div>
          </div>
        </div>

        <nav aria-label="Dispatcher navigation">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navCls}>
              <Icon size={17} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="topbar-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <strong>{user?.name ?? 'Dispatcher'}</strong>
              <span>{user?.email ?? ''}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
        <header className="topbar">
          <div className="topbar-title" />
          <div className="topbar-actions">
            <NavLink to="/dispatcher/notifications" className="topbar-icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </NavLink>
            <div className="topbar-avatar" title={user?.name}>{initials}</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DispatcherLayout
