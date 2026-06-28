import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import RouteFallback from '../components/RouteFallback'
import SyncStatusBar from '../components/SyncStatusBar'
import CustomerBottomNav from '../components/customer/CustomerBottomNav'
import CustomerLegalFooter from '../components/customer/CustomerLegalFooter'
import CustomerNavBar from '../components/customer/CustomerNavBar'
import SessionStatusBar from '../components/session/SessionStatusBar'
import { CustomerSurfaceProvider } from '../context/CustomerSurfaceContext'
import { isStandalonePwa } from '../utils/pwaUtils'

function CustomerLayout() {
  const pwaMode = isStandalonePwa()

  return (
    <CustomerSurfaceProvider surface="pwa">
      <div className={`customer-layout${pwaMode ? ' customer-layout--pwa' : ''}`} id="main-content">
      <SessionStatusBar />
      <CustomerNavBar />
      <SyncStatusBar variant="customer" />

      <PageTransition>
        <main className="customer-layout-main">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </PageTransition>

      <CustomerLegalFooter compact={pwaMode} />
      <CustomerBottomNav />
      </div>
    </CustomerSurfaceProvider>
  )
}

export default CustomerLayout
