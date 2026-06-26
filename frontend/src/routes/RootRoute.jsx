import { Navigate } from 'react-router-dom'
import LandingPage from '../pages/LandingPage'
import { isStandalonePwa } from '../utils/pwaUtils'

/** Browser users see the marketing landing page; installed customer PWA opens the portal. */
function RootRoute() {
  if (isStandalonePwa()) {
    return <Navigate to="/customer" replace />
  }
  return <LandingPage />
}

export default RootRoute
