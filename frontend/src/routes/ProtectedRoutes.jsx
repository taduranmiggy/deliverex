import { Loader2 } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { roleHome } from '../utils/roleUtils'

function ProtectedRoutes({ children, roles }) {
  const { isAuthenticated, role, bootstrapped, user } = useAuth()
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
        pathname.startsWith('/customer/signup') ||
        pathname.startsWith('/customer/login') ||
        pathname.startsWith('/customer/about') ||
        pathname.startsWith('/customer/services') ||
        pathname.startsWith('/customer/support') ||
        pathname.startsWith('/customer/history') ||
        pathname.startsWith('/customer/account')
      if (!customerPublic) {
        loginPath = '/customer/login'
      } else {
        return children
      }
    }

    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  if (roles && !roles.includes(role)) {
    const fallback = role ? roleHome(role) : '/login'
    return <Navigate to={fallback} replace />
  }

  const { pathname } = location
  const mustChangePassword = Boolean(user?.must_change_password)

  if (role === 'driver' && mustChangePassword && pathname !== '/driver/change-password') {
    return <Navigate to="/driver/change-password" replace />
  }

  if (role === 'driver' && !mustChangePassword && pathname === '/driver/change-password') {
    return <Navigate to="/driver" replace />
  }

  return children
}

export default ProtectedRoutes
