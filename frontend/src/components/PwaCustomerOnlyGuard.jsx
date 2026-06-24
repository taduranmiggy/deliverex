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

  return <Navigate to="/customer" replace />
}

export default PwaCustomerOnlyGuard
