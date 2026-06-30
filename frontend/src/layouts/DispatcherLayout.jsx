import {
  Bell, Calendar, FileSearch, LayoutDashboard, Map, Route, Truck,
} from 'lucide-react'
import StaffAppShell from './StaffAppShell'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dispatcher', label: 'Dashboard', Icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Dispatch',
    items: [
      { to: '/dispatcher/job-orders', label: 'Job Orders', Icon: Truck },
      { to: '/dispatcher/dispatch', label: 'Fleet Dispatch', Icon: Route },
      { to: '/dispatcher/calendar', label: 'Calendar', Icon: Calendar },
      { to: '/dispatcher/live-tracking', label: 'Live Tracking', Icon: Map },
    ],
  },
  {
    label: 'Review',
    items: [
      { to: '/dispatcher/ocr-review', label: 'OCR Review', Icon: FileSearch },
      { to: '/dispatcher/notifications', label: 'Notifications', Icon: Bell },
    ],
  },
]

function DispatcherLayout() {
  return (
    <StaffAppShell
      roleLabel="Dispatcher"
      brandIcon={Route}
      navSections={NAV_SECTIONS}
      notificationPath="/dispatcher/notifications"
      profilePath="/dispatcher/profile"
    />
  )
}

export default DispatcherLayout
