import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoutes from './ProtectedRoutes'
import { roleRoutes } from './roleRoutes'
import CompanyActivationPage from '../pages/Auth/CompanyActivationPage'
import LoginPage from '../pages/Auth/LoginPage'
import DriverLoginPage from '../pages/Auth/DriverLoginPage'
import DriverChangePasswordPage from '../pages/Driver/DriverChangePasswordPage'
import DriverSignupPage from '../pages/Auth/DriverSignupPage'
import BusinessSignupPage from '../pages/Auth/BusinessSignupPage'
import AdminLayout from '../layouts/AdminLayout'
import DispatcherLayout from '../layouts/DispatcherLayout'
import DriverLayout from '../layouts/DriverLayout'
import ManagerLayout from '../layouts/ManagerLayout'
import CustomerLayout from '../layouts/CustomerLayout'
import PwaCustomerOnlyGuard from '../components/PwaCustomerOnlyGuard'
import BrowserCustomerPortalGuard from '../components/BrowserCustomerPortalGuard'
import RootRoute from './RootRoute'

function AppRouter() {
  return (
    <BrowserRouter>
      <PwaCustomerOnlyGuard>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/track" element={<Navigate to="/customer/track" replace />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate-company/:token" element={<CompanyActivationPage />} />
          <Route path="/driver/login" element={<DriverLoginPage />} />
          <Route
            path="/driver/change-password"
            element={
              <ProtectedRoutes roles={['driver']}>
                <DriverChangePasswordPage />
              </ProtectedRoutes>
            }
          />
          <Route path="/driver/signup" element={<DriverSignupPage />} />
          <Route path="/signup/business" element={<BusinessSignupPage />} />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoutes roles={['admin']}>
                <AdminLayout />
              </ProtectedRoutes>
            }
          >
            {roleRoutes.admin}
          </Route>

          <Route
            path="/dispatcher/*"
            element={
              <ProtectedRoutes roles={['dispatcher']}>
                <DispatcherLayout />
              </ProtectedRoutes>
            }
          >
            {roleRoutes.dispatcher}
          </Route>

          <Route
            path="/driver/*"
            element={
              <ProtectedRoutes roles={['driver']}>
                <DriverLayout />
              </ProtectedRoutes>
            }
          >
            {roleRoutes.driver}
          </Route>

          <Route
            path="/manager/*"
            element={
              <ProtectedRoutes roles={['manager']}>
                <ManagerLayout />
              </ProtectedRoutes>
            }
          >
            {roleRoutes.manager}
          </Route>

          <Route
            path="/customer/*"
            element={
              <BrowserCustomerPortalGuard>
                <CustomerLayout />
              </BrowserCustomerPortalGuard>
            }
          >
            {roleRoutes.customer}
          </Route>
        </Routes>
      </PwaCustomerOnlyGuard>
    </BrowserRouter>
  )
}

export default AppRouter
