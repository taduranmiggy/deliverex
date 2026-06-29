import { NavLink } from 'react-router-dom'
import { HeadphonesIcon, History, LayoutDashboard, MapPin, Package } from 'lucide-react'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'

const NAV_ITEMS = [
  { pathKey: 'dashboard', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { pathKey: 'track', icon: MapPin, label: 'Track' },
  { pathKey: 'deliveries', icon: Package, label: 'Deliveries' },
  { pathKey: 'history', icon: History, label: 'History' },
  { pathKey: 'support', icon: HeadphonesIcon, label: 'Support' },
]

function CustomerWebsiteBottomNav() {
  const { paths } = useCustomerSurface()

  return (
    <nav className="customer-bottom-nav customer-bottom-nav--website" aria-label="Customer portal navigation">
      {NAV_ITEMS.map(({ pathKey, end, icon: Icon, label }) => (
        <NavLink
          key={pathKey}
          to={paths[pathKey]}
          end={end}
          className={({ isActive }) =>
            `customer-bottom-nav-item${isActive ? ' active' : ''}`
          }
        >
          <span className="customer-bottom-nav-item__icon-wrap">
            <Icon size={20} className="customer-bottom-nav-item__icon" strokeWidth={2} aria-hidden />
          </span>
          <span className="customer-bottom-nav-item__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default CustomerWebsiteBottomNav
