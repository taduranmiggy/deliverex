import { Outlet } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import CustomerBottomNav from '../components/customer/CustomerBottomNav'
import CustomerLegalFooter from '../components/customer/CustomerLegalFooter'
import CustomerNavBar from '../components/customer/CustomerNavBar'
import SessionStatusBar from '../components/session/SessionStatusBar'

function CustomerLayout() {
  return (
    <div className="customer-layout" id="main-content">
      <SessionStatusBar />
      <CustomerNavBar />

      <PageTransition>
        <main className="customer-layout-main">
          <Outlet />
        </main>
      </PageTransition>

      <CustomerLegalFooter />
      <CustomerBottomNav />
    </div>
  )
}

export default CustomerLayout
