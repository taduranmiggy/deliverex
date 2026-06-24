import { NavLink, Outlet } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import PageTransition from '../components/PageTransition'
import useAuth from '../hooks/useAuth'
import {
  BarChart3, Bell, FileSearch, History, LayoutDashboard, MapPin, TrendingUp,
} from 'lucide-react'

const navCls = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`

const NAV = [
  { to: '/manager',                    label: 'Dashboard',   Icon: LayoutDashboard, end: true },
  { to: '/manager/analytics',          label: 'Analytics',   Icon: BarChart3 },
  { to: '/manager/delivery-history',   label: 'History',     Icon: History },
  { to: '/manager/reports',            label: 'Reports',     Icon: TrendingUp },
  { to: '/manager/delivery-documentation', label: 'OCR / Delivery Documentation', Icon: FileSearch },
  { to: '/manager/fleet-tracking',     label: 'Fleet Tracking', Icon: MapPin },
  { to: '/manager/notifications',      label: 'Notifications', Icon: Bell },
]

function ManagerLayout() {
  const { user } = useAuth()
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'MG'

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-icon" aria-hidden>
              <BarChart3 size={18} color="#fff" />
            </div>
            <div>
              <div className="brand">Deliverex</div>
              <div className="sidebar-role-label">Manager</div>
            </div>
          </div>
        </div>

        <nav aria-label="Manager navigation">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navCls}>
              <Icon size={17} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="profile">
          <div className="sidebar-user">
            <div className="topbar-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            <div className="sidebar-user__info">
              <span className="sidebar-user__name">{user?.name ?? 'Manager'}</span>
              <span
                className="sidebar-user__email"
                title={user?.email ?? ''}
              >
                {user?.email ?? ''}
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
        <header className="topbar">
          <div className="topbar-title" />
          <div className="topbar-actions">
            <NavLink to="/manager/notifications" className="topbar-icon-btn" aria-label="Notifications">
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

export default ManagerLayout
