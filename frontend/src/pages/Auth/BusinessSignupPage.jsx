import { Navigate } from 'react-router-dom'

/** Business signup is inquiry-only — redirect to public customer site. */
function BusinessSignupPage() {
  return <Navigate to="/customer" replace />
}

export default BusinessSignupPage
