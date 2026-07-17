import {
  Bell, Bot, Building2, ClipboardList, FileSearch, FileText, Inbox, LayoutDashboard, Mail, Settings, Shield, Users,
} from 'lucide-react'
import StaffAppShell from './StaffAppShell'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/job-orders', label: 'Job Orders', Icon: ClipboardList },
      { to: '/admin/ocr-validation', label: 'OCR Review', Icon: FileSearch },
      { to: '/admin/master-data', label: 'Master Data', Icon: Settings },
      { to: '/admin/companies', label: 'Companies', Icon: Building2 },
      { to: '/admin/users', label: 'User Management', Icon: Users },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/admin/chatbot', label: 'Chatbot', Icon: Bot },
      { to: '/admin/inquiries', label: 'Customer Concerns', Icon: Inbox },
      { to: '/admin/audit-logs', label: 'Audit Logs', Icon: FileText },
      { to: '/admin/email-logs', label: 'Email Logs', Icon: Mail },
      { to: '/admin/notifications', label: 'Notifications', Icon: Bell },
    ],
  },
]

function AdminLayout() {
  return (
    <StaffAppShell
      roleLabel="Admin"
      brandIcon={Shield}
      navSections={NAV_SECTIONS}
      notificationPath="/admin/notifications"
      profilePath="/admin/profile"
    />
  )
}

export default AdminLayout
