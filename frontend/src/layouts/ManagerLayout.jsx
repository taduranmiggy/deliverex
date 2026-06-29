import {
  BarChart3, Bell, FileSearch, History, LayoutDashboard, MapPin, TrendingUp,
} from 'lucide-react'
import StaffAppShell from './StaffAppShell'

const NAV = [
  { to: '/manager', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/manager/analytics', label: 'Analytics', Icon: BarChart3 },
  { to: '/manager/delivery-history', label: 'History', Icon: History },
  { to: '/manager/reports', label: 'Reports', Icon: TrendingUp },
  { to: '/manager/delivery-documentation', label: 'OCR Review', Icon: FileSearch },
  { to: '/manager/fleet-tracking', label: 'Fleet Tracking', Icon: MapPin },
  { to: '/manager/notifications', label: 'Notifications', Icon: Bell },
]

function ManagerLayout() {
  return (
    <StaffAppShell
      roleLabel="Manager"
      brandIcon={BarChart3}
      navItems={NAV}
      notificationPath="/manager/notifications"
      profilePath="/manager/profile"
    />
  )
}

export default ManagerLayout
