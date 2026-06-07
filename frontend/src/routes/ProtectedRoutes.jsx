import { Loader2 } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { roleHome } from '../utils/roleUtils'

function ProtectedRoutes({ children, roles }) {
  const { isAuthenticated, role, bootstrapped } = useAuth()
  const location = useLocation()

  if (!bootstrapped) {
    return (
      <div className="dx-boot-loading" aria-label="Loading Deliverex…">
        <div className="dx-boot-spinner">
          <Loader2 size={36} aria-hidden />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    let loginPath = '/login'
    const { pathname } = location
    if (pathname.startsWith('/driver')) {
      loginPath = '/driver/login'
    } else if (pathname.startsWith('/customer')) {
      const customerPublic =
        pathname === '/customer' ||
        pathname === '/customer/' ||
        pathname.startsWith('/customer/track') ||
        pathname.startsWith('/customer/signup')
      if (!customerPublic) {
        loginPath = '/login'
      }
    }

    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  if (roles && !roles.includes(role)) {
    const fallback = role ? roleHome(role) : '/login'
    return <Navigate to={fallback} replace />
  }

  return children
}

export default ProtectedRoutes
