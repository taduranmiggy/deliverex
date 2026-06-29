import { Link, NavLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import CustomerBrandMark from './CustomerBrandMark'
import { getCustomerNavPaths } from '../../utils/customerSurfacePaths'

const PUBLIC_LINKS = [
  { key: 'about', label: 'About' },
  { key: 'services', label: 'Services' },
  { key: 'support', label: 'Support' },
  { key: 'track', label: 'Track Delivery' },
]

function PublicSiteNavBar() {
  const paths = getCustomerNavPaths({ isCustomer: false, isPwa: false })
  const navLinkCls = ({ isActive }) => `customer-nav-link${isActive ? ' active' : ''}`

  return (
    <nav className="customer-nav customer-nav--public" role="navigation" aria-label="Site navigation">
      <div className="customer-nav-inner">
        <Link to="/" className="customer-nav-brand">
          <CustomerBrandMark />
          <span className="customer-nav-brand-text">Deliverex</span>
        </Link>

        <div className="customer-nav-links customer-nav-links--desktop">
          {PUBLIC_LINKS.map(({ key, label }) => (
            <NavLink key={key} to={paths[key]} className={navLinkCls}>
              {label}
            </NavLink>
          ))}
        </div>

        <div className="customer-nav-actions customer-nav-actions--desktop">
          <Link to={paths.signIn} className="btn-dx-primary btn-sm">
            Sign in <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default PublicSiteNavBar
