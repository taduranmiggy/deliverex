import { Outlet } from 'react-router-dom'
import ProtectedRoutes from './ProtectedRoutes'

/** Wrap nested customer routes that require authentication. */
function ProtectedCustomerOutlet() {
  return (
    <ProtectedRoutes roles={['customer']}>
      <Outlet />
    </ProtectedRoutes>
  )
}

export default ProtectedCustomerOutlet
