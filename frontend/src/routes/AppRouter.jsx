import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoutes from './ProtectedRoutes'
import { roleRoutes } from './roleRoutes'
import LandingPage from '../pages/LandingPage'
import LoginPage from '../pages/Auth/LoginPage'
import DriverLoginPage from '../pages/Auth/DriverLoginPage'
import DriverSignupPage from '../pages/Auth/DriverSignupPage'
import BusinessSignupPage from '../pages/Auth/BusinessSignupPage'
import TrackingPage from '../pages/Customer/TrackingPage'
import AdminLayout from '../layouts/AdminLayout'
import DispatcherLayout from '../layouts/DispatcherLayout'
import DriverLayout from '../layouts/DriverLayout'
import ManagerLayout from '../layouts/ManagerLayout'
import CustomerLayout from '../layouts/CustomerLayout'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/driver/login" element={<DriverLoginPage />} />
        <Route path="/driver/signup" element={<DriverSignupPage />} />
        <Route path="/signup/business" element={<BusinessSignupPage />} />
        <Route path="/track" element={<TrackingPage />} />

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
          element={<CustomerLayout />}
        >
          {roleRoutes.customer}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
