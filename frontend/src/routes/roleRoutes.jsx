import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'
import ProtectedCustomerOutlet from './ProtectedCustomerOutlet'

// Route-level code splitting: every page is loaded on demand so each role only
// downloads the chunks it actually visits. Suspense boundaries live in the
// layouts (StaffAppShell, DriverLayout, CustomerLayout, CustomerWebsiteLayout).
// All pages are default exports, so lazy() works without interop changes.

// Admin
const CompanyManagementPage = lazy(() => import('../pages/Admin/CompanyManagementPage'))
const AdminDashboard = lazy(() => import('../pages/Admin/AdminDashboard'))
const AdminJobOrdersPage = lazy(() => import('../pages/Admin/AdminJobOrdersPage'))
const UserManagementPage = lazy(() => import('../pages/Admin/UserManagementPage'))
const OcrReviewPage = lazy(() => import('../pages/Admin/OcrReviewPage'))
const AdminMasterDataPage = lazy(() => import('../pages/Admin/AdminMasterDataPage'))
const AdminAuditLogsPage = lazy(() => import('../pages/Admin/AdminAuditLogsPage'))
const AdminEmailLogsPage = lazy(() => import('../pages/Admin/AdminEmailLogsPage'))
const AdminChatbotPage = lazy(() => import('../pages/Admin/AdminChatbotPage'))
const NotificationsPage = lazy(() => import('../pages/Admin/NotificationsPage'))

// Dispatcher
const DispatcherDashboard = lazy(() => import('../pages/Dispatcher/DispatcherDashboard'))
const CreateJobOrderPage = lazy(() => import('../pages/Dispatcher/CreateJobOrderPage'))
const AssignDriverVehiclePage = lazy(() => import('../pages/Dispatcher/AssignDriverVehiclePage'))
const DeliveryMonitoringPage = lazy(() => import('../pages/Dispatcher/DeliveryMonitoringPage'))
const DispatcherCalendarPage = lazy(() => import('../pages/Dispatcher/DispatcherCalendarPage'))
const DispatcherNotificationsPage = lazy(() => import('../pages/Dispatcher/DispatcherNotificationsPage'))

// Driver
const DriverHomePage = lazy(() => import('../pages/Driver/DriverHomePage'))
const DriverJobsPage = lazy(() => import('../pages/Driver/DriverJobsPage'))
const DriverNotificationsPage = lazy(() => import('../pages/Driver/DriverNotificationsPage'))
const DeliveryStatusUpdatePage = lazy(() => import('../pages/Driver/DeliveryStatusUpdatePage'))
const DriverJobDetailsPage = lazy(() => import('../pages/Driver/DriverJobDetailsPage'))
const DocumentUploadPage = lazy(() => import('../pages/Driver/DocumentUploadPage'))
const DriverProfilePage = lazy(() => import('../pages/Driver/DriverProfilePage'))

// Manager
const ManagerDashboard = lazy(() => import('../pages/Manager/ManagerDashboard'))
const AnalyticsPage = lazy(() => import('../pages/Manager/AnalyticsPage'))
const ReportsPage = lazy(() => import('../pages/Manager/ReportsPage'))
const ManagerDeliveryHistoryPage = lazy(() => import('../pages/Manager/ManagerDeliveryHistoryPage'))
const ManagerNotificationsPage = lazy(() => import('../pages/Manager/ManagerNotificationsPage'))
const ManagerFleetTrackingPage = lazy(() => import('../pages/Manager/ManagerFleetTrackingPage'))

// Customer (PWA + website share several pages)
const CustomerCompanyUsersPage = lazy(() => import('../pages/Customer/CustomerCompanyUsersPage'))
const CustomerHomePage = lazy(() => import('../pages/Customer/CustomerHomePage'))
const TrackingPage = lazy(() => import('../pages/Customer/TrackingPage'))
const CustomerLoginPage = lazy(() => import('../pages/Customer/CustomerLoginPage'))
const CustomerForgotPasswordPage = lazy(() => import('../pages/Customer/CustomerForgotPasswordPage'))
const CustomerDeliveriesPage = lazy(() => import('../pages/Customer/CustomerDeliveriesPage'))
const CustomerLinkDeliveryPage = lazy(() => import('../pages/Customer/CustomerLinkDeliveryPage'))
const CustomerAccountPage = lazy(() => import('../pages/Customer/CustomerAccountPage'))
const CustomerSupportPage = lazy(() => import('../pages/Customer/CustomerSupportPage'))
const CustomerHistoryPage = lazy(() => import('../pages/Customer/CustomerHistoryPage'))
const AboutUsPage = lazy(() => import('../pages/Customer/AboutUsPage'))
const ServicesPage = lazy(() => import('../pages/Customer/ServicesPage'))
const CustomerLegalPage = lazy(() => import('../pages/Customer/CustomerLegalPage'))
const CustomerWebsiteDashboardPage = lazy(() => import('../pages/CustomerWeb/CustomerWebsiteDashboardPage'))

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
  customerWebsite: [
    <Route key="customer-web-default" index element={<Navigate to="dashboard" replace />} />,
    <Route key="customer-web-dashboard" path="dashboard" element={<CustomerWebsiteDashboardPage />} />,
    <Route key="customer-web-track" path="track" element={<TrackingPage />} />,
    <Route key="customer-web-deliveries" path="deliveries" element={<CustomerDeliveriesPage />} />,
    <Route key="customer-web-history" path="history" element={<CustomerHistoryPage />} />,
    <Route key="customer-web-support" path="support" element={<CustomerSupportPage />} />,
    <Route key="customer-web-link" path="link-delivery" element={<CustomerLinkDeliveryPage />} />,
    <Route key="customer-web-team" path="team" element={<CustomerCompanyUsersPage />} />,
    <Route key="customer-web-profile" path="profile" element={<CustomerAccountPage />} />,
  ],
}
