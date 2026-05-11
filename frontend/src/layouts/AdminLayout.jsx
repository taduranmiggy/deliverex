import { NavLink, Outlet } from 'react-router-dom'
import ChatFab from '../components/ChatFab'
import LogoutButton from '../components/LogoutButton'
import {
  IconBell,
  IconClipboard,
  IconDashboard,
  IconDoc,
  IconChart,
  IconChat,
  IconUsers,
} from '../components/DxIcons'
import useAuth from '../hooks/useAuth'

const navCls = ({ isActive }) =>
  `sidebar-link${isActive ? ' active' : ''}`

function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="brand">Deliverex</div>
          <div className="sidebar-role-label">Admin</div>
        </div>
        <nav aria-label="Primary navigation">
          <NavLink to="/admin" end className={navCls}>
            <IconDashboard />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/ocr-validation" className={navCls}>
            <IconDoc />
            <span>OCR Validation</span>
          </NavLink>
          <NavLink to="/admin/master-data" className={navCls}>
            <IconClipboard />
            <span>Master Data</span>
          </NavLink>
          <NavLink to="/admin/users" className={navCls}>
            <IconUsers />
            <span>Users &amp; Roles</span>
          </NavLink>
          <NavLink to="/admin/chatbot" className={navCls}>
            <IconChat />
            <span>Chatbot Management</span>
          </NavLink>
          <NavLink to="/admin/audit-logs" className={navCls}>
            <IconChart />
            <span>Audit Logs</span>
          </NavLink>
          <NavLink to="/admin/notifications" className={navCls}>
            <IconBell />
            <span>Notifications</span>
          </NavLink>
        </nav>
        <div className="profile">
          <strong>{user?.name ?? 'Admin'}</strong>
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

export default AdminLayout
