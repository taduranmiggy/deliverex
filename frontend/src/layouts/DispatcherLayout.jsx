import { NavLink, Outlet } from 'react-router-dom'
import ChatFab from '../components/ChatFab'
import LogoutButton from '../components/LogoutButton'
import {
  IconBell,
  IconClipboard,
  IconDashboard,
  IconMap,
  IconRoute,
} from '../components/DxIcons'
import useAuth from '../hooks/useAuth'

const navCls = ({ isActive }) =>
  `sidebar-link${isActive ? ' active' : ''}`

function DispatcherLayout() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="brand">Deliverex</div>
          <div className="sidebar-role-label">Dispatcher</div>
        </div>
        <nav aria-label="Primary navigation">
          <NavLink to="/dispatcher" end className={navCls}>
            <IconDashboard />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/dispatcher/job-orders" className={navCls}>
            <IconClipboard />
            <span>Job Orders</span>
          </NavLink>
          <NavLink to="/dispatcher/dispatch-best-fit" className={navCls}>
            <IconRoute />
            <span>Dispatch (Best-Fit)</span>
          </NavLink>
          <NavLink to="/dispatcher/live-tracking" className={navCls}>
            <IconMap />
            <span>Live Tracking</span>
          </NavLink>
          <NavLink to="/dispatcher/notifications" className={navCls}>
            <IconBell />
            <span>Notifications</span>
          </NavLink>
        </nav>
        <div className="profile">
          <strong>{user?.name ?? 'Dispatcher'}</strong>
          <span>{user?.email ?? ''}</span>
          <LogoutButton />
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="page page--deliverex">
        <Outlet />
      </main>
      <ChatFab />
    </div>
  )
}

export default DispatcherLayout
