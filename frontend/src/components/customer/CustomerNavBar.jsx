import { Link, NavLink } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { isStandalonePwa } from '../../utils/pwaUtils'
import { BriefcaseBusiness, Home, Info, MapPin, Package, Truck } from 'lucide-react'

function CustomerNavBar() {
  const { user, isAuthenticated, role } = useAuth()
  const isCustomer = isAuthenticated && role === 'customer'
  const signInPath = isStandalonePwa() ? '/customer/login' : '/login'
  const homePath = isStandalonePwa() ? '/customer' : '/'

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DC'

  const navLinkCls = ({ isActive }) =>
    `customer-nav-link${isActive ? ' active' : ''}`

  const pwaMode = isStandalonePwa()

  return (
    <nav className={`customer-nav${pwaMode ? ' customer-nav--pwa' : ''}`} role="navigation" aria-label="Customer navigation">
      <div className="customer-nav-inner">
        <Link to={homePath} className="customer-nav-brand">
          <div className="customer-nav-brand-icon" aria-hidden>
            <Truck size={18} color="#fff" />
          </div>
          <span className="customer-nav-brand-text">Deliverex</span>
        </Link>

        <div className="customer-nav-links customer-nav-links--desktop">
          <NavLink to={homePath} end className={navLinkCls}>
            <Home size={15} /> Home
          </NavLink>
          <NavLink to="/customer/track" className={navLinkCls}>
            <MapPin size={15} /> Track
          </NavLink>
          <NavLink to="/customer/about" className={navLinkCls}>
            <Info size={15} /> About
          </NavLink>
          <NavLink to="/customer/services" className={navLinkCls}>
            <BriefcaseBusiness size={15} /> Services
          </NavLink>
          <NavLink to="/customer/support" className={navLinkCls}>
            Support
          </NavLink>
          {isCustomer && (
            <NavLink to="/customer/deliveries" className={navLinkCls}>
              <Package size={15} /> Deliveries
            </NavLink>
          )}
        </div>

        <div className="customer-nav-actions customer-nav-actions--desktop">
          {isCustomer ? (
            <NavLink to="/customer/account" className="customer-nav-user">
              <div className="customer-nav-avatar">{initials}</div>
              <span className="customer-nav-user-name">{user?.name ?? 'Account'}</span>
            </NavLink>
          ) : (
            <div className="customer-nav-auth-btns">
              <Link to={signInPath} className="btn-dx-primary btn-sm">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default CustomerNavBar
