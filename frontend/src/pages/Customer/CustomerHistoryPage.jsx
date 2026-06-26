import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'
import useAuth from '../../hooks/useAuth'
import CustomerSkeleton from '../../components/customer/CustomerSkeleton'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import { isStandalonePwa } from '../../utils/pwaUtils'
import { StatusBadge } from '../../components/ui'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'
import { History, Package } from 'lucide-react'

const ACTIVE = ['pending', 'assigned', 'in_progress', 'arrived']

function CustomerHistoryPage() {
  const { isAuthenticated, role } = useAuth()
  const navigate = useNavigate()
  const isCustomer = isAuthenticated && role === 'customer'
  const signInPath = isStandalonePwa() ? '/customer/login' : '/login'
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isCustomer) return undefined
    let cancelled = false
    setLoading(true)
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) setOrders(res?.data ?? []) })
      .catch(() => { if (!cancelled) setOrders([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isCustomer])

  if (!isCustomer) {
    return (
      <CustomerPageShell className="pwa-page">
        <CustomerPageHeader
          eyebrow="History"
          title="Delivery History"
          description="Sign in to view shipments linked to your account."
        />
        <div className="pwa-empty-state pwa-empty-state--float">
          <div className="pwa-empty-state__icon" aria-hidden>
            <History size={32} />
          </div>
          <p className="pwa-empty-state__title">No deliveries yet</p>
          <p className="pwa-empty-state__message">
            Create an account or sign in to access your delivery history. You can still track any shipment using a Tracking ID.
          </p>
          <div className="pwa-empty-state__actions">
            <Link to="/customer/track" className="btn-dx-primary">Track Delivery</Link>
            <Link to={signInPath} className="btn-dx-secondary">Sign In</Link>
          </div>
        </div>
      </CustomerPageShell>
    )
  }

  const completed = orders.filter((o) => o.status === 'completed')
  const active = orders.filter((o) => ACTIVE.includes(o.status))

  return (
    <CustomerPageShell className="pwa-page">
      <CustomerPageHeader
        eyebrow="History"
        title="My Deliveries"
        description={`${orders.length} shipment${orders.length === 1 ? '' : 's'} linked to your account`}
      />

      {loading ? (
        <CustomerSkeleton variant="delivery" count={4} />
      ) : orders.length === 0 ? (
        <div className="pwa-empty-state pwa-empty-state--float">
          <div className="pwa-empty-state__icon" aria-hidden>
            <Package size={32} />
          </div>
          <p className="pwa-empty-state__title">No deliveries yet</p>
          <p className="pwa-empty-state__message">Link a tracking ID or wait for new shipments assigned to your email.</p>
          <div className="pwa-empty-state__actions">
            <Link to="/customer/link-delivery" className="btn-dx-primary">Link Delivery</Link>
            <Link to="/customer/track" className="btn-dx-secondary">Track by ID</Link>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="pwa-section">
              <h2 className="pwa-section__title">Active</h2>
              <div className="pwa-delivery-cards">
                {active.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="pwa-delivery-card"
                    onClick={() => navigate('/customer/deliveries', { state: { openOrderId: order.id } })}
                  >
                    <div className="pwa-delivery-card__top">
                      <span className="pwa-delivery-card__code">{order.tracking_code}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="pwa-delivery-card__route">
                      {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section className="pwa-section">
              <h2 className="pwa-section__title">Completed</h2>
              <div className="pwa-delivery-cards">
                {completed.slice(0, 8).map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="pwa-delivery-card"
                    onClick={() => navigate('/customer/deliveries', { state: { openOrderId: order.id } })}
                  >
                    <div className="pwa-delivery-card__top">
                      <span className="pwa-delivery-card__code">{order.tracking_code}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="pwa-delivery-card__route">
                      {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                    </p>
                  </button>
                ))}
              </div>
              {completed.length > 8 && (
                <Link to="/customer/deliveries" className="btn-dx-secondary btn-sm" style={{ marginTop: 12 }}>
                  View all deliveries
                </Link>
              )}
            </section>
          )}
        </>
      )}
    </CustomerPageShell>
  )
}

export default CustomerHistoryPage
