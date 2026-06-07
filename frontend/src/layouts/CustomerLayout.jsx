import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { ChevronDown, Home, HelpCircle, LogOut, MapPin, Package, Truck, User } from 'lucide-react'

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
    navigate('/login', { replace: true })
  }

  const navLinkCls = ({ isActive }) =>
    `customer-nav-link${isActive ? ' active' : ''}`

  return (
    <div className="customer-layout">
      {/* Top Navbar */}
      <nav className="customer-nav" role="navigation" aria-label="Customer navigation">
        <div className="customer-nav-inner">
          <Link to="/customer" className="customer-nav-brand">
            <div className="customer-nav-brand-icon" aria-hidden>
              <Truck size={18} color="#fff" />
            </div>
            <span className="customer-nav-brand-text">Deliverex</span>
          </Link>

          <div className="customer-nav-links">
            <NavLink to="/customer" end className={navLinkCls}>
              <Home size={15} /> Home
            </NavLink>
            <NavLink to="/customer/track" className={navLinkCls}>
              <MapPin size={15} /> Track Delivery
            </NavLink>
            {isCustomer && (
              <NavLink to="/customer/deliveries" className={navLinkCls}>
                <Package size={15} /> My Deliveries
              </NavLink>
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
                  <span>{user?.name ?? 'Account'}</span>
                  <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {dropdownOpen && (
                  <div className="customer-user-dropdown">
                    <Link to="/customer" onClick={() => setDropdownOpen(false)}>
                      <Home size={15} /> Home
                    </Link>
                    <Link to="/customer/deliveries" onClick={() => setDropdownOpen(false)}>
                      <Package size={15} /> My Deliveries
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
                <Link to="/login" className="btn-dx-secondary btn-sm">Sign in</Link>
                <Link to="/customer/signup" className="btn-dx-primary btn-sm">Create account</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <Outlet />
    </div>
  )
}

export default CustomerLayout
