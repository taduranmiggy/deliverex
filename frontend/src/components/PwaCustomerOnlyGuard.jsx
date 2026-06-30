import { Navigate, useLocation } from 'react-router-dom'
import { isCustomerPwaPath, isStandalonePwa } from '../utils/pwaUtils'

/**
 * In the installed customer PWA, block driver/staff routes and send users to the customer portal.
 */
function PwaCustomerOnlyGuard({ children }) {
  const { pathname } = useLocation()

  if (!isStandalonePwa() || isCustomerPwaPath(pathname)) {
    return children
  }

  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return <Navigate to="/customer/login" replace />
  }

  if (pathname === '/forgot-password' || pathname.startsWith('/forgot-password')) {
    return <Navigate to="/customer/forgot-password" replace />
  }

  if (pathname === '/reset-password' || pathname.startsWith('/reset-password')) {
    return children
  }

  if (pathname === '/activate-account' || pathname.startsWith('/activate-account')) {
    return children
  }

  if (pathname.startsWith('/driver')) {
    return <Navigate to="/customer/login" replace />
  }

  return <Navigate to="/customer" replace />
}

export default PwaCustomerOnlyGuard
