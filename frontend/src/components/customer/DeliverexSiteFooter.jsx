import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { getCustomerNavPaths } from '../../utils/customerSurfacePaths'
import { isStandalonePwa } from '../../utils/pwaUtils'

const LEGAL_LINKS = [
  { to: '/customer/privacy-policy', label: 'Privacy Policy' },
  { to: '/customer/terms-and-conditions', label: 'Terms and Conditions' },
  { to: '/customer/data-privacy-notice', label: 'Data Privacy Notice' },
]

const EXPLORE_LINKS = [
  { key: 'about', label: 'About Us' },
  { key: 'services', label: 'Services' },
  { key: 'support', label: 'Support' },
  { key: 'track', label: 'Track Delivery' },
]

function DeliverexSiteFooter({ className = '' }) {
  const { paths } = useCustomerSurface()
  const { isAuthenticated, role } = useAuth()
  const isCustomer = isAuthenticated && role === 'customer'
  const navPaths = getCustomerNavPaths({ isCustomer, isPwa: isStandalonePwa() })
  const signInPath = navPaths.signIn ?? '/login'

  const exploreLinks = EXPLORE_LINKS.map(({ key, label }) => ({
    to: paths[key] ?? `/customer/${key}`,
    label,
  }))

  return (
    <footer className={`dx-site-footer${className ? ` ${className}` : ''}`}>
      <div className="customer-container dx-site-footer__grid">
        <div className="dx-site-footer__col">
          <p className="dx-site-footer__brand">Deliverex</p>
          <p className="dx-site-footer__about">
            Logistics dispatch, delivery tracking, and proof-of-delivery for site preparation teams.
          </p>
        </div>

        <div className="dx-site-footer__col">
          <p className="dx-site-footer__heading">Explore</p>
          {exploreLinks.map((link) => (
            <p key={link.to} className="dx-site-footer__link-row">
              <Link to={link.to}>{link.label}</Link>
            </p>
          ))}
        </div>

        <div className="dx-site-footer__col">
          <p className="dx-site-footer__heading">Account</p>
          <p className="dx-site-footer__link-row">
            <Link to={signInPath}>Sign in</Link>
          </p>
          <p className="dx-site-footer__note">
            Company accounts are created by your administrator.
          </p>
        </div>

        <div className="dx-site-footer__col">
          <p className="dx-site-footer__heading">Legal</p>
          {LEGAL_LINKS.map((link) => (
            <p key={link.to} className="dx-site-footer__link-row">
              <Link to={link.to}>{link.label}</Link>
            </p>
          ))}
        </div>
      </div>

      <p className="dx-site-footer__copy">
        Deliverex Logistics · Providential 628 Site Preparation Services
      </p>
    </footer>
  )
}

export default DeliverexSiteFooter
