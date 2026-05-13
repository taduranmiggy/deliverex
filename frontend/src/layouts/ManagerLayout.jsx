import { NavLink, Outlet } from 'react-router-dom'
import ChatFab from '../components/ChatFab'
import LogoutButton from '../components/LogoutButton'
import useAuth from '../hooks/useAuth'
import {
  BarChart3, Bell, History, LayoutDashboard, TrendingUp,
} from 'lucide-react'

const navCls = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`

const NAV = [
  { to: '/manager',                    label: 'Dashboard',   Icon: LayoutDashboard, end: true },
  { to: '/manager/analytics',          label: 'Analytics',   Icon: BarChart3 },
  { to: '/manager/delivery-history',   label: 'History',     Icon: History },
  { to: '/manager/reports',            label: 'Reports',     Icon: TrendingUp },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="topbar-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <strong>{user?.name ?? 'Manager'}</strong>
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
            <NavLink to="/manager/notifications" className="topbar-icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </NavLink>
            <div className="topbar-avatar" title={user?.name}>{initials}</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          <Outlet />
        </main>
      </div>
      <ChatFab />
    </div>
  )
}

export default ManagerLayout
