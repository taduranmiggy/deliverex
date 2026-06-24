import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import useAuth from '../hooks/useAuth'
import { BriefcaseBusiness, ChevronDown, Home, Info, Link2, LogOut, MapPin, Package, Settings, Truck } from 'lucide-react'

function CustomerLayout() {
  const { user, isAuthenticated, role, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropRef = useRef(null)

  const isCustomer = isAuthenticated && role === 'customer'
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DC'

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/customer', { replace: true })
  }

  const navLinkCls = ({ isActive }) =>
    `customer-nav-link${isActive ? ' active' : ''}`

  const bottomNavCls = ({ isActive }) =>
    `customer-bottom-nav-item${isActive ? ' active' : ''}`

  return (
    <div className="customer-layout">
      <nav className="customer-nav" role="navigation" aria-label="Customer navigation">
        <div className="customer-nav-inner">
          <Link to="/customer" className="customer-nav-brand">
            <div className="customer-nav-brand-icon" aria-hidden>
              <Truck size={18} color="#fff" />
            </div>
            <span className="customer-nav-brand-text">Deliverex</span>
          </Link>

          <div className="customer-nav-links customer-nav-links--desktop">
            <NavLink to="/customer" end className={navLinkCls}>
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
            {isCustomer && (
              <>
                <NavLink to="/customer/deliveries" className={navLinkCls}>
                  <Package size={15} /> My Deliveries
                </NavLink>
                <NavLink to="/customer/link-delivery" className={navLinkCls}>
                  <Link2 size={15} /> Link Delivery
                </NavLink>
              </>
            )}
          </div>

          <div className="customer-nav-actions">
            {isCustomer ? (
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="customer-nav-user"
                  onClick={() => setDropdownOpen((v) => !v)}
                  aria-expanded={dropdownOpen}
                >
                  <div className="customer-nav-avatar">{initials}</div>
                  <span className="customer-nav-user-name">{user?.name ?? 'Account'}</span>
                  <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {dropdownOpen && (
                  <div className="customer-user-dropdown">
                    <Link to="/customer/deliveries" onClick={() => setDropdownOpen(false)}>
                      <Package size={15} /> My Deliveries
                    </Link>
                    <Link to="/customer/link-delivery" onClick={() => setDropdownOpen(false)}>
                      <Link2 size={15} /> Link Delivery
                    </Link>
                    <Link to="/customer/account" onClick={() => setDropdownOpen(false)}>
                      <Settings size={15} /> Account Settings
                    </Link>
                    <Link to="/customer/track" onClick={() => setDropdownOpen(false)}>
                      <MapPin size={15} /> Track Delivery
                    </Link>
                    <div className="dropdown-divider" />
                    <button onClick={handleLogout} className="dropdown-logout">
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/customer/login" className="btn-dx-secondary btn-sm">Sign in</Link>
                <Link to="/customer/signup" className="btn-dx-primary btn-sm">Create account</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <PageTransition>
        <div className="customer-layout-main">
          <Outlet />
        </div>
      </PageTransition>

      <nav className="customer-bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/customer" end className={bottomNavCls}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/customer/track" className={bottomNavCls}>
          <MapPin size={20} />
          <span>Track</span>
        </NavLink>
        <NavLink to="/customer/about" className={bottomNavCls}>
          <Info size={20} />
          <span>About</span>
        </NavLink>
        <NavLink to="/customer/services" className={bottomNavCls}>
          <BriefcaseBusiness size={20} />
          <span>Services</span>
        </NavLink>
        {isCustomer ? (
          <NavLink to="/customer/deliveries" className={bottomNavCls}>
            <Package size={20} />
            <span>Deliveries</span>
          </NavLink>
        ) : (
          <NavLink to="/customer/signup" className={bottomNavCls}>
            <Package size={20} />
            <span>Sign up</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}

export default CustomerLayout
