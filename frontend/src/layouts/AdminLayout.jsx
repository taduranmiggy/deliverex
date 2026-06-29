import {
  Bell, Bot, Building2, ClipboardList, FileSearch, LayoutDashboard, Mail, Settings, Shield, Users,
} from 'lucide-react'
import StaffAppShell from './StaffAppShell'

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/job-orders', label: 'Job Orders', Icon: ClipboardList },
  { to: '/admin/ocr-validation', label: 'OCR Review', Icon: FileSearch },
  { to: '/admin/master-data', label: 'Master Data', Icon: Settings },
  { to: '/admin/companies', label: 'Companies', Icon: Building2 },
  { to: '/admin/users', label: 'User Management', Icon: Users },
  { to: '/admin/chatbot', label: 'Chatbot Management', Icon: Bot },
  { to: '/admin/audit-logs', label: 'Audit Logs', Icon: ClipboardList },
  { to: '/admin/email-logs', label: 'Email Logs', Icon: Mail },
  { to: '/admin/notifications', label: 'Notifications', Icon: Bell },
]

function AdminLayout() {
  return (
    <StaffAppShell
      roleLabel="Admin"
      brandIcon={Shield}
      navItems={NAV}
      notificationPath="/admin/notifications"
      profilePath="/admin/profile"
    />
  )
}

export default AdminLayout
