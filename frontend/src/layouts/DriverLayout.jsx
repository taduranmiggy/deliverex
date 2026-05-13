import { NavLink, Outlet } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import useAuth from '../hooks/useAuth'
import { ClipboardCheck, FileUp, Truck, LogOut } from 'lucide-react'

const navCls = ({ isActive }) => `driver-nav-link${isActive ? ' driver-nav-link--active' : ''}`

function DriverLayout() {
  const { user } = useAuth()
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DR'

  return (
    <div className="driver-shell">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="sidebar sidebar--deliverex driver-sidebar-desktop">
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-icon" aria-hidden>
              <Truck size={18} color="#fff" />
            </div>
            <div>
              <div className="brand">Deliverex</div>
              <div className="sidebar-role-label">Driver</div>
            </div>
          </div>
        </div>

        <nav aria-label="Driver navigation">
          <NavLink to="/driver" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Truck size={17} aria-hidden />
            <span>My Jobs</span>
          </NavLink>
          <NavLink to="/driver/status-update" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <ClipboardCheck size={17} aria-hidden />
            <span>Status Update</span>
          </NavLink>
          <NavLink to="/driver/documents" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <FileUp size={17} aria-hidden />
            <span>Upload Documents</span>
          </NavLink>
        </nav>

        <div className="profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="topbar-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <strong>{user?.name ?? 'Driver'}</strong>
              <span>{user?.email ?? ''}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="driver-main">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="driver-bottom-nav" aria-label="Driver navigation">
        <NavLink to="/driver" end className={navCls}>
          <Truck size={22} aria-hidden />
          <span>Jobs</span>
        </NavLink>
        <NavLink to="/driver/status-update" className={navCls}>
          <ClipboardCheck size={22} aria-hidden />
          <span>Status</span>
        </NavLink>
        <NavLink to="/driver/documents" className={navCls}>
          <FileUp size={22} aria-hidden />
          <span>Docs</span>
        </NavLink>
        <div className="driver-nav-logout">
          <LogoutButton compact />
        </div>
      </nav>
    </div>
  )
}

export default DriverLayout
