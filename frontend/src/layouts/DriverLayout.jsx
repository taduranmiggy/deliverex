import { NavLink, Outlet } from 'react-router-dom'
import ChatFab from '../components/ChatFab'
import LogoutButton from '../components/LogoutButton'
import { IconClipboard, IconDashboard, IconDoc } from '../components/DxIcons'
import useAuth from '../hooks/useAuth'

const navCls = ({ isActive }) =>
  `sidebar-link${isActive ? ' active' : ''}`

function DriverLayout() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="brand">Deliverex</div>
          <div className="sidebar-role-label">Driver</div>
        </div>
        <nav aria-label="Primary navigation">
          <NavLink to="/driver" end className={navCls}>
            <IconDashboard />
            <span>My Jobs</span>
          </NavLink>
          <NavLink to="/driver/status-update" className={navCls}>
            <IconClipboard />
            <span>Status Update</span>
          </NavLink>
          <NavLink to="/driver/documents" className={navCls}>
            <IconDoc />
            <span>Upload Documents</span>
          </NavLink>
        </nav>
        <div className="profile">
          <strong>{user?.name ?? 'Driver'}</strong>
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

export default DriverLayout
