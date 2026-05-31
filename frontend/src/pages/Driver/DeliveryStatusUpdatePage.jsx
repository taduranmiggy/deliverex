import { Navigate } from 'react-router-dom'

/** Status updates are handled on the job details page. */
function DeliveryStatusUpdatePage() {
  return <Navigate to="/driver" replace />
}

export default DeliveryStatusUpdatePage
