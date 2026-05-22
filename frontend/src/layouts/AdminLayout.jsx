import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import ChatFab from '../components/ChatFab'
import LogoutButton from '../components/LogoutButton'
import useAuth from '../hooks/useAuth'
import {
  Bell, Bot, ChevronRight, ClipboardList, FileSearch,
  LayoutDashboard, LogOut, Settings, Shield, Users,
} from 'lucide-react'

const navCls = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`

const NAV = [
  { to: '/admin',            label: 'Dashboard',         Icon: LayoutDashboard, end: true },
  { to: '/admin/job-orders',     label: 'Job Orders',      Icon: ClipboardList },
  { to: '/admin/dispatch-best-fit', label: 'Fleet Dispatch', Icon: Shield },
  { to: '/admin/ocr-validation', label: 'OCR Validation', Icon: FileSearch },
  { to: '/admin/master-data',    label: 'Master Data',    Icon: Settings },
  { to: '/admin/users',          label: 'Users & Roles',  Icon: Users },
  { to: '/admin/chatbot',        label: 'Chatbot',        Icon: Bot },
  { to: '/admin/audit-logs',     label: 'Audit Logs',     Icon: ClipboardList },
  { to: '/admin/notifications',  label: 'Notifications',  Icon: Bell },
]

function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AD'

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar--deliverex">
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-icon" aria-hidden>
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div className="brand">Deliverex</div>
              <div className="sidebar-role-label">Admin</div>
            </div>
          </div>
        </div>

        <nav aria-label="Admin navigation">
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
              <strong>{user?.name ?? 'Admin'}</strong>
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
            <NavLink to="/admin/notifications" className="topbar-icon-btn" aria-label="Notifications">
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

export default AdminLayout
