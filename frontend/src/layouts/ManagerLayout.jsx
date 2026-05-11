import { NavLink, Outlet } from 'react-router-dom'
import ChatFab from '../components/ChatFab'
import LogoutButton from '../components/LogoutButton'
import {
  IconBell,
  IconChart,
  IconClipboard,
  IconDashboard,
} from '../components/DxIcons'
import useAuth from '../hooks/useAuth'

const navCls = ({ isActive }) =>
  `sidebar-link${isActive ? ' active' : ''}`

function ManagerLayout() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="brand">Deliverex</div>
          <div className="sidebar-role-label">Manager</div>
        </div>
        <nav aria-label="Primary navigation">
          <NavLink to="/manager" end className={navCls}>
            <IconDashboard />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/manager/analytics" className={navCls}>
            <IconChart />
            <span>Analytics</span>
          </NavLink>
          <NavLink to="/manager/delivery-history" className={navCls}>
            <IconClipboard />
            <span>Delivery History</span>
          </NavLink>
          <NavLink to="/manager/reports" className={navCls}>
            <IconChart />
            <span>Reports</span>
          </NavLink>
          <NavLink to="/manager/notifications" className={navCls}>
            <IconBell />
            <span>Notifications</span>
          </NavLink>
        </nav>
        <div className="profile">
          <strong>{user?.name ?? 'Manager'}</strong>
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

export default ManagerLayout
