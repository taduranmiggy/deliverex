import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import CustomerBrandMark from './CustomerBrandMark'
import {
  ChevronDown,
  HeadphonesIcon,
  History,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  Package,
  User,
  Users,
} from 'lucide-react'

const PRIMARY_NAV = [
  { pathKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { pathKey: 'track', label: 'Track', icon: MapPin },
  { pathKey: 'deliveries', label: 'Deliveries', icon: Package },
  { pathKey: 'history', label: 'History', icon: History },
  { pathKey: 'support', label: 'Support', icon: HeadphonesIcon },
]

function CustomerWebsiteNavBar() {
  const { user, logout } = useAuth()
  const { paths } = useCustomerSurface()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DC'

  const navLinkCls = ({ isActive }) =>
    `customer-nav-link${isActive ? ' active' : ''}`

  useEffect(() => {
    if (!menuOpen) return undefined

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate(paths.signIn, { replace: true })
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="customer-nav customer-nav--website" role="navigation" aria-label="Customer website navigation">
      <div className="customer-nav-inner">
        <Link to={paths.dashboard} className="customer-nav-brand">
          <CustomerBrandMark />
          <span className="customer-nav-brand-text">Deliverex</span>
        </Link>

        <div className="customer-nav-links customer-nav-links--desktop customer-nav-links--website">
          {PRIMARY_NAV.map(({ pathKey, label, icon: Icon, end }) => (
            <NavLink key={pathKey} to={paths[pathKey]} end={end} className={navLinkCls}>
              <Icon size={15} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="customer-nav-actions customer-nav-actions--desktop customer-nav-actions--website">
          <div className="customer-web-account-menu" ref={menuRef}>
            <button
              type="button"
              className={`customer-nav-user customer-web-account-menu__trigger${menuOpen ? ' customer-web-account-menu__trigger--open' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <div className="customer-nav-avatar">{initials}</div>
              <span className="customer-nav-user-name">{user?.name ?? 'Account'}</span>
              <ChevronDown size={14} className="customer-web-account-menu__chevron" aria-hidden />
            </button>

            {menuOpen && (
              <div className="customer-user-dropdown customer-web-account-menu__panel" role="menu">
                <p className="customer-web-account-menu__heading">{user?.name ?? 'Account'}</p>
                <NavLink to={paths.profile} className="customer-web-account-menu__item" role="menuitem" onClick={closeMenu}>
                  <User size={15} aria-hidden />
                  Profile
                </NavLink>
                <NavLink to={paths.linkDelivery} className="customer-web-account-menu__item" role="menuitem" onClick={closeMenu}>
                  <Link2 size={15} aria-hidden />
                  Link delivery
                </NavLink>
                {user?.company_role === 'owner' ? (
                  <NavLink to={paths.team} className="customer-web-account-menu__item" role="menuitem" onClick={closeMenu}>
                    <Users size={15} aria-hidden />
                    Team
                  </NavLink>
                ) : null}
                <NavLink to={paths.support} className="customer-web-account-menu__item customer-web-account-menu__item--mobile" role="menuitem" onClick={closeMenu}>
                  <HeadphonesIcon size={15} aria-hidden />
                  Support
                </NavLink>
                <div className="customer-web-account-menu__divider" role="separator" />
                <button type="button" className="customer-web-account-menu__item customer-web-account-menu__item--danger" role="menuitem" onClick={handleLogout}>
                  <LogOut size={15} aria-hidden />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default CustomerWebsiteNavBar
