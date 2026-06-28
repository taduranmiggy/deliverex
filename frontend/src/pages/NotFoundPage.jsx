import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Home, LayoutDashboard, Package } from 'lucide-react'
import useAuth from '../hooks/useAuth'

const DASHBOARD_PATHS = {
  admin: '/admin',
  dispatcher: '/dispatcher',
  driver: '/driver',
  manager: '/manager',
  customer: '/customer',
}

/**
 * Branded catch-all 404 page.
 *
 * Purely additive — it only renders for paths that match no existing route, so
 * it never affects current routing, guards, or navigation behavior.
 */
function NotFoundPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuth()
  const dashboardPath = role ? DASHBOARD_PATHS[role] : null

  return (
    <main className="dx-notfound">
      <div className="dx-notfound__card dx-fade-in">
        <div className="dx-notfound__brand">
          <span className="dx-notfound__brand-dot" aria-hidden="true">
            <Package size={15} />
          </span>
          Deliverex
        </div>

        <p className="dx-notfound__code">404</p>
        <h1 className="dx-notfound__title">Page not found</h1>
        <p className="dx-notfound__message">
          The page you are looking for doesn’t exist or may have been moved.
          Check the address, or head back to a familiar place.
        </p>

        <div className="dx-notfound__actions">
          <button
            type="button"
            className="btn-dx-secondary dx-btn-with-icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={15} /> Go back
          </button>

          {isAuthenticated && dashboardPath ? (
            <Link to={dashboardPath} className="btn-dx-primary dx-btn-with-icon">
              <LayoutDashboard size={15} /> Go to Dashboard
            </Link>
          ) : (
            <Link to="/" className="btn-dx-primary dx-btn-with-icon">
              <Home size={15} /> Return Home
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

export default NotFoundPage
