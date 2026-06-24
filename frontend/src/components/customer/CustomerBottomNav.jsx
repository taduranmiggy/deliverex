import { NavLink } from 'react-router-dom'
import { HeadphonesIcon, History, Home, MapPin, User } from 'lucide-react'
import useAuth from '../../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/customer', end: true, icon: Home, label: 'Home' },
  { to: '/customer/track', icon: MapPin, label: 'Track' },
  { to: '/customer/history', icon: History, label: 'History' },
  { to: '/customer/support', icon: HeadphonesIcon, label: 'Support' },
  { to: '/customer/account', icon: User, label: 'Account' },
]

function CustomerBottomNav() {
  const { isAuthenticated, role } = useAuth()
  const isCustomer = isAuthenticated && role === 'customer'

  return (
    <nav className="customer-bottom-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `customer-bottom-nav-item${isActive ? ' active' : ''}`
          }
        >
          <span className="customer-bottom-nav-item__icon-wrap">
            <Icon size={20} className="customer-bottom-nav-item__icon" />
          </span>
          <span className="customer-bottom-nav-item__label">{label}</span>
        </NavLink>
      ))}
      {!isCustomer && (
        <span className="sr-only">Sign in from Account tab to view delivery history</span>
      )}
    </nav>
  )
}

export default CustomerBottomNav
