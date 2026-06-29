import {
  Bell, Calendar, FileSearch, LayoutDashboard, Map, Route, Truck,
} from 'lucide-react'
import StaffAppShell from './StaffAppShell'

const NAV = [
  { to: '/dispatcher', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/dispatcher/job-orders', label: 'Job Orders', Icon: Truck },
  { to: '/dispatcher/dispatch', label: 'Fleet Dispatch', Icon: Route },
  { to: '/dispatcher/calendar', label: 'Calendar', Icon: Calendar },
  { to: '/dispatcher/live-tracking', label: 'Tracking', Icon: Map },
  { to: '/dispatcher/ocr-review', label: 'OCR Review', Icon: FileSearch },
  { to: '/dispatcher/notifications', label: 'Notifications', Icon: Bell },
]

function DispatcherLayout() {
  return (
    <StaffAppShell
      roleLabel="Dispatcher"
      brandIcon={Route}
      navItems={NAV}
      notificationPath="/dispatcher/notifications"
      profilePath="/dispatcher/profile"
    />
  )
}

export default DispatcherLayout
