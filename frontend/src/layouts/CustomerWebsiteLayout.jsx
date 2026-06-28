import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { History, LayoutDashboard, LogOut, User } from 'lucide-react'
import SessionStatusBar from '../components/session/SessionStatusBar'
import CustomerLegalFooter from '../components/customer/CustomerLegalFooter'
import useAuth from '../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/customer-web/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customer-web/history', label: 'Delivery History', icon: History },
  { to: '/customer-web/profile', label: 'Profile', icon: User },
]

function CustomerWebsiteLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="customer-web-layout" id="main-content">
      <SessionStatusBar />
      <div className="customer-web-shell">
        <aside className="customer-web-sidebar" aria-label="Customer website navigation">
          <div className="customer-web-brand">
            <strong>Deliverex</strong>
            <span>Customer Website</span>
          </div>
          <nav className="customer-web-nav">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `customer-web-nav-link${isActive ? ' active' : ''}`}>
                <Icon size={18} aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <button type="button" className="customer-web-logout" onClick={handleLogout}>
            <LogOut size={18} aria-hidden />
            Sign Out
          </button>
        </aside>

        <section className="customer-web-main">
          <header className="customer-web-header">
            <h1>Welcome, {user?.name?.split(' ')[0] ?? 'Customer'}</h1>
            <p>{user?.company_name ?? user?.email}</p>
          </header>
          <div className="customer-web-content">
            <Outlet />
          </div>
        </section>
      </div>
      <CustomerLegalFooter />
    </div>
  )
}

export default CustomerWebsiteLayout
