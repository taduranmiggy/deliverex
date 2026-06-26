import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { isStandalonePwa } from '../utils/pwaUtils'

/**
 * Keeps the customer app shell (home, marketing pages, customer login) inside the
 * installed PWA. The main website uses / and /login instead.
 */
function BrowserCustomerPortalGuard({ children }) {
  const { pathname } = useLocation()
  const { isAuthenticated, role, bootstrapped } = useAuth()

  if (isStandalonePwa() || !bootstrapped) {
    return children
  }

  if (pathname === '/customer/login') {
    return <Navigate to="/login" replace />
  }

  const isCustomer = isAuthenticated && role === 'customer'
  const isGuestCustomerHome =
    (pathname === '/customer' || pathname === '/customer/') && !isCustomer

  if (isGuestCustomerHome) {
    return <Navigate to="/" replace />
  }

  return children
}

export default BrowserCustomerPortalGuard
