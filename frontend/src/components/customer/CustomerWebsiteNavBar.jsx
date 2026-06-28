import { Link, NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import {
  History,
  Link2,
  LogOut,
  MapPin,
  Package,
  Truck,
  Users,
} from 'lucide-react'

function CustomerWebsiteNavBar() {
  const { user, logout } = useAuth()
  const { paths } = useCustomerSurface()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DC'

  const navLinkCls = ({ isActive }) =>
    `customer-nav-link${isActive ? ' active' : ''}`

  const handleLogout = async () => {
    await logout()
    navigate(paths.signIn, { replace: true })
  }

  return (
    <nav className="customer-nav customer-nav--website" role="navigation" aria-label="Customer website navigation">
      <div className="customer-nav-inner">
        <Link to={paths.dashboard} className="customer-nav-brand">
          <div className="customer-nav-brand-icon" aria-hidden>
            <Truck size={18} color="#fff" />
          </div>
          <span className="customer-nav-brand-text">Deliverex</span>
        </Link>

        <div className="customer-nav-links customer-nav-links--desktop customer-nav-links--website">
          <NavLink to={paths.dashboard} end className={navLinkCls}>
            Dashboard
          </NavLink>
          <NavLink to={paths.track} className={navLinkCls}>
            <MapPin size={15} aria-hidden /> Track
          </NavLink>
          <NavLink to={paths.deliveries} className={navLinkCls}>
            <Package size={15} aria-hidden /> Deliveries
          </NavLink>
          <NavLink to={paths.history} className={navLinkCls}>
            <History size={15} aria-hidden /> History
          </NavLink>
          <NavLink to={paths.support} className={navLinkCls}>
            Support
          </NavLink>
        </div>

        <div className="customer-nav-actions customer-nav-actions--desktop customer-nav-actions--website">
          <NavLink to={paths.linkDelivery} className="customer-nav-link customer-nav-link--action">
            <Link2 size={15} aria-hidden /> Link
          </NavLink>
          {user?.company_role === 'owner' ? (
            <NavLink to={paths.team} className="customer-nav-link customer-nav-link--action">
              <Users size={15} aria-hidden /> Team
            </NavLink>
          ) : null}
          <NavLink to={paths.profile} className="customer-nav-user">
            <div className="customer-nav-avatar">{initials}</div>
            <span className="customer-nav-user-name">{user?.name ?? 'Account'}</span>
          </NavLink>
          <button type="button" className="customer-web-nav-signout" onClick={handleLogout}>
            <LogOut size={15} aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default CustomerWebsiteNavBar
