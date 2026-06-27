import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'
import CompanyManagementPage from '../pages/Admin/CompanyManagementPage'
import AdminDashboard from '../pages/Admin/AdminDashboard'
import AdminJobOrdersPage from '../pages/Admin/AdminJobOrdersPage'
import UserManagementPage from '../pages/Admin/UserManagementPage'
import OcrReviewPage from '../pages/Admin/OcrReviewPage'
import AdminMasterDataPage from '../pages/Admin/AdminMasterDataPage'
import AdminAuditLogsPage from '../pages/Admin/AdminAuditLogsPage'
import AdminEmailLogsPage from '../pages/Admin/AdminEmailLogsPage'
import AdminChatbotPage from '../pages/Admin/AdminChatbotPage'
import NotificationsPage from '../pages/Admin/NotificationsPage'
import DispatcherDashboard from '../pages/Dispatcher/DispatcherDashboard'
import CreateJobOrderPage from '../pages/Dispatcher/CreateJobOrderPage'
import AssignDriverVehiclePage from '../pages/Dispatcher/AssignDriverVehiclePage'
import DeliveryMonitoringPage from '../pages/Dispatcher/DeliveryMonitoringPage'
import DispatcherCalendarPage from '../pages/Dispatcher/DispatcherCalendarPage'
import DispatcherNotificationsPage from '../pages/Dispatcher/DispatcherNotificationsPage'
import DriverHomePage from '../pages/Driver/DriverHomePage'
import DriverJobsPage from '../pages/Driver/DriverJobsPage'
import DriverNotificationsPage from '../pages/Driver/DriverNotificationsPage'
import DeliveryStatusUpdatePage from '../pages/Driver/DeliveryStatusUpdatePage'

const DriverJobDetailsPage = lazy(() => import('../pages/Driver/DriverJobDetailsPage'))
const DocumentUploadPage = lazy(() => import('../pages/Driver/DocumentUploadPage'))
const DriverProfilePage = lazy(() => import('../pages/Driver/DriverProfilePage'))
import ManagerDashboard from '../pages/Manager/ManagerDashboard'
import AnalyticsPage from '../pages/Manager/AnalyticsPage'
import ReportsPage from '../pages/Manager/ReportsPage'
import ManagerDeliveryHistoryPage from '../pages/Manager/ManagerDeliveryHistoryPage'
import ManagerNotificationsPage from '../pages/Manager/ManagerNotificationsPage'
import ManagerFleetTrackingPage from '../pages/Manager/ManagerFleetTrackingPage'
import CustomerCompanyUsersPage from '../pages/Customer/CustomerCompanyUsersPage'
import CustomerHomePage from '../pages/Customer/CustomerHomePage'
import TrackingPage from '../pages/Customer/TrackingPage'
import CustomerLoginPage from '../pages/Customer/CustomerLoginPage'
import CustomerForgotPasswordPage from '../pages/Customer/CustomerForgotPasswordPage'
import CustomerDeliveriesPage from '../pages/Customer/CustomerDeliveriesPage'
import CustomerLinkDeliveryPage from '../pages/Customer/CustomerLinkDeliveryPage'
import CustomerAccountPage from '../pages/Customer/CustomerAccountPage'
import CustomerSupportPage from '../pages/Customer/CustomerSupportPage'
import CustomerHistoryPage from '../pages/Customer/CustomerHistoryPage'
import AboutUsPage from '../pages/Customer/AboutUsPage'
import ServicesPage from '../pages/Customer/ServicesPage'
import CustomerLegalPage from '../pages/Customer/CustomerLegalPage'
import ProtectedCustomerOutlet from './ProtectedCustomerOutlet'

export const roleRoutes = {
  admin: [
    <Route key="admin-home"       index                  element={<AdminDashboard />} />,
    <Route key="admin-ocr"        path="ocr-validation"  element={<OcrReviewPage />} />,
    <Route key="admin-master"     path="master-data"     element={<AdminMasterDataPage />} />,
    <Route key="admin-job-orders" path="job-orders"      element={<AdminJobOrdersPage />} />,
    /* admin-dispatch intentionally removed — dispatch is Dispatcher-role only */
    <Route key="admin-companies"  path="companies"       element={<CompanyManagementPage />} />,
    <Route key="admin-users"      path="users"           element={<UserManagementPage />} />,
    <Route key="admin-chatbot"    path="chatbot"         element={<AdminChatbotPage />} />,
    <Route key="admin-audit"      path="audit-logs"      element={<AdminAuditLogsPage />} />,
    <Route key="admin-email"      path="email-logs"      element={<AdminEmailLogsPage />} />,
    <Route key="admin-notifs"     path="notifications"   element={<NotificationsPage />} />,
  ],
  dispatcher: [
    <Route key="dispatcher-home" index element={<DispatcherDashboard />} />,
    <Route key="dispatcher-job" path="job-orders" element={<CreateJobOrderPage />} />,
    <Route key="dispatcher-calendar" path="calendar" element={<DispatcherCalendarPage />} />,
    <Route key="dispatcher-ocr" path="ocr-review" element={<OcrReviewPage />} />,
    <Route key="dispatcher-assign" path="dispatch-best-fit" element={<AssignDriverVehiclePage />} />,
    <Route key="dispatcher-monitor" path="live-tracking" element={<DeliveryMonitoringPage />} />,
    <Route key="dispatcher-notifs" path="notifications" element={<DispatcherNotificationsPage />} />,
  ],
  driver: [
    <Route key="driver-home" index element={<DriverHomePage />} />,
    <Route key="driver-jobs" path="jobs" element={<DriverJobsPage />} />,
    <Route key="driver-job" path="jobs/:id" element={<DriverJobDetailsPage />} />,
    <Route key="driver-notifs" path="notifications" element={<DriverNotificationsPage />} />,
    <Route key="driver-status" path="status-update" element={<DeliveryStatusUpdatePage />} />,
    <Route key="driver-docs" path="documents" element={<DocumentUploadPage />} />,
    <Route key="driver-profile" path="profile" element={<DriverProfilePage />} />,
  ],
  manager: [
    <Route key="manager-home" index element={<ManagerDashboard />} />,
    <Route key="manager-analytics" path="analytics" element={<AnalyticsPage />} />,
    <Route key="manager-history" path="delivery-history" element={<ManagerDeliveryHistoryPage />} />,
    <Route key="manager-reports" path="reports" element={<ReportsPage />} />,
    <Route key="manager-ocr" path="delivery-documentation" element={<OcrReviewPage />} />,
    <Route key="manager-fleet" path="fleet-tracking" element={<ManagerFleetTrackingPage />} />,
    <Route key="manager-notifs" path="notifications" element={<ManagerNotificationsPage />} />,
  ],
  customer: [
    <Route key="customer-home" index element={<CustomerHomePage />} />,
    <Route key="customer-about" path="about" element={<AboutUsPage />} />,
    <Route key="customer-services" path="services" element={<ServicesPage />} />,
    <Route key="customer-login" path="login" element={<CustomerLoginPage />} />,
    <Route key="customer-forgot" path="forgot-password" element={<CustomerForgotPasswordPage />} />,
    <Route key="customer-track" path="track" element={<TrackingPage />} />,
    <Route key="customer-support" path="support" element={<CustomerSupportPage />} />,
    <Route key="customer-privacy" path="privacy-policy" element={<CustomerLegalPage type="privacy-policy" />} />,
    <Route key="customer-terms" path="terms-and-conditions" element={<CustomerLegalPage type="terms-and-conditions" />} />,
    <Route key="customer-data-privacy" path="data-privacy-notice" element={<CustomerLegalPage type="data-privacy-notice" />} />,
    <Route key="customer-history" path="history" element={<CustomerHistoryPage />} />,
    <Route key="customer-account" path="account" element={<CustomerAccountPage />} />,
    <Route key="customer-auth-gate" element={<ProtectedCustomerOutlet />}>
      <Route key="customer-deliveries" path="deliveries" element={<CustomerDeliveriesPage />} />
      <Route key="customer-team" path="team" element={<CustomerCompanyUsersPage />} />
      <Route key="customer-link" path="link-delivery" element={<CustomerLinkDeliveryPage />} />
    </Route>,
  ],
}
