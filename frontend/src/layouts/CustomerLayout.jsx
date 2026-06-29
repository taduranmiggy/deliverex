import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import RouteFallback from '../components/RouteFallback'
import SyncStatusBar from '../components/SyncStatusBar'
import CustomerBottomNav from '../components/customer/CustomerBottomNav'
import DeliverexSiteFooter from '../components/customer/DeliverexSiteFooter'
import CustomerNavBar from '../components/customer/CustomerNavBar'
import SessionStatusBar from '../components/session/SessionStatusBar'
import { CustomerSurfaceProvider } from '../context/CustomerSurfaceContext'
import { isStandalonePwa } from '../utils/pwaUtils'

function CustomerLayout() {
  const pwaMode = isStandalonePwa()

  useEffect(() => {
    if (!pwaMode) return undefined
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('deliverex:app-ready'))
    })
    return () => cancelAnimationFrame(id)
  }, [pwaMode])

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

      <DeliverexSiteFooter />
      <CustomerBottomNav />
      </div>
    </CustomerSurfaceProvider>
  )
}

export default CustomerLayout
