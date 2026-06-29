import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import RouteFallback from '../components/RouteFallback'
import DeliverexSiteFooter from '../components/customer/DeliverexSiteFooter'
import CustomerWebsiteNavBar from '../components/customer/CustomerWebsiteNavBar'
import CustomerWebsiteBottomNav from '../components/customer/CustomerWebsiteBottomNav'
import SessionStatusBar from '../components/session/SessionStatusBar'
import { CustomerSurfaceProvider } from '../context/CustomerSurfaceContext'

function CustomerWebsiteLayout() {
  return (
    <CustomerSurfaceProvider surface="web">
      <div className="customer-layout customer-layout--website" id="main-content">
        <SessionStatusBar />
        <CustomerWebsiteNavBar />

        <PageTransition>
          <main className="customer-layout-main">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </PageTransition>

        <DeliverexSiteFooter />
        <CustomerWebsiteBottomNav />
      </div>
    </CustomerSurfaceProvider>
  )
}

export default CustomerWebsiteLayout
