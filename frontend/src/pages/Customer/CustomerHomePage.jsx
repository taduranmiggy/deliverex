import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchCustomerOrders } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerActionCard from '../../components/customer/CustomerActionCard'
import CustomerSkeleton from '../../components/customer/CustomerSkeleton'
import { StatusBadge } from '../../components/ui'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'
import useAuth from '../../hooks/useAuth'
import {
  BriefcaseBusiness, FileText, HeadphonesIcon, History, Info,
  MapPin, MessageSquare, Package, Search, Truck,
} from 'lucide-react'

const ACTIVE_STATUSES = ['pending', 'assigned', 'in_progress', 'arrived']
const NOTIFICATION_LABELS = {
  assigned: 'Assigned',
  in_progress: 'En Route',
  arrived: 'Arrived',
  completed: 'Delivered',
}

function CustomerHomePage() {
  const { isAuthenticated, role, user } = useAuth()
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)
  const [trackCode, setTrackCode] = useState('')
  const [customerOrders, setCustomerOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  const isCustomer = isAuthenticated && role === 'customer'

  useEffect(() => {
    if (!isCustomer) return undefined
    let cancelled = false
    setLoadingOrders(true)
    fetchCustomerOrders()
      .then((res) => { if (!cancelled) { setCustomerOrders(res?.data ?? []); setOrdersLoaded(true) } })
      .catch(() => { if (!cancelled) { setCustomerOrders([]); setOrdersLoaded(true) } })
      .finally(() => { if (!cancelled) setLoadingOrders(false) })
    return () => { cancelled = true }
  }, [isCustomer])

  const activeOrders = useMemo(
    () => customerOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [customerOrders],
  )
  const recentCompleted = useMemo(
    () => customerOrders.filter((o) => o.status === 'completed').slice(0, 3),
    [customerOrders],
  )

  const statusCounts = useMemo(() => {
    const counts = { assigned: 0, in_progress: 0, arrived: 0, completed: 0 }
    customerOrders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status] += 1
    })
    return counts
  }, [customerOrders])

  const handleTrack = (e) => {
    e.preventDefault()
    if (trackCode.trim()) {
      navigate('/customer/track', { state: { prefillTracking: trackCode.trim() } })
    }
  }

  const guestActions = [
    { icon: MapPin, title: 'Track Delivery', description: 'Look up status by Tracking ID', to: '/customer/track' },
    { icon: History, title: 'Delivery History', description: 'View past shipments when signed in', to: '/customer/history' },
    { icon: FileText, title: 'Proof of Delivery', description: 'Access POD after completion', to: '/customer/track' },
    { icon: HeadphonesIcon, title: 'Contact Support', description: 'Phone, email, and inquiries', to: '/customer/support' },
    { icon: MessageSquare, title: 'Chat Assistant', description: 'Get instant help', onClick: () => setChatOpen(true) },
    { icon: Info, title: 'About Us', description: 'Learn about Deliverex', to: '/customer/about' },
    { icon: BriefcaseBusiness, title: 'Our Services', description: 'Logistics solutions we offer', to: '/customer/services' },
  ]

  return (
    <div className="pwa-home">
      <section className="pwa-hero">
        <div className="pwa-hero__inner">
          {isCustomer ? (
            <>
              <p className="pwa-hero__eyebrow">Welcome back</p>
              <h1 className="pwa-hero__title">{user?.name?.split(' ')[0] ?? 'Customer'}</h1>
              <p className="pwa-hero__subtitle">
                Monitor delivery progress, estimated arrivals, and proof-of-delivery records.
              </p>
            </>
          ) : (
            <>
              <p className="pwa-hero__eyebrow">Deliverex Customer</p>
              <h1 className="pwa-hero__title">Track Your Deliveries Easily</h1>
              <p className="pwa-hero__subtitle">
                Monitor delivery status, estimated arrival time, proof-of-delivery records, and shipment history.
              </p>
            </>
          )}

          <form className="pwa-hero__track" onSubmit={handleTrack}>
            <div className="pwa-hero__track-input-wrap">
              <Search size={18} className="pwa-hero__track-icon" aria-hidden />
              <input
                type="text"
                placeholder="Enter Tracking ID"
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                aria-label="Tracking ID"
              />
            </div>
            <button type="submit" className="pwa-hero__track-btn">Track Delivery</button>
          </form>

          {!isCustomer && (
            <div className="pwa-hero__cta-row">
              <Link to="/customer/login" className="btn-dx-secondary pwa-hero__cta">Sign In</Link>
              <Link to="/customer/signup" className="btn-dx-primary pwa-hero__cta">Create Account</Link>
            </div>
          )}
        </div>
      </section>

      <div className="customer-content pwa-home__body">
        {isCustomer && (
          <section className="pwa-section">
            <h2 className="pwa-section__title">Dashboard</h2>
            {loadingOrders && !ordersLoaded ? (
              <CustomerSkeleton variant="stat" count={4} />
            ) : (
              <>
                <div className="pwa-notif-chips">
                  {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
                    <span key={key} className={`pwa-notif-chip${statusCounts[key] > 0 ? ' pwa-notif-chip--active' : ''}`}>
                      <Truck size={14} />
                      {label}
                      <strong>{statusCounts[key]}</strong>
                    </span>
                  ))}
                </div>

                <h3 className="pwa-section__subtitle">Active Deliveries</h3>
                {activeOrders.length === 0 ? (
                  <p className="pwa-section__hint">No active deliveries right now.</p>
                ) : (
                  <div className="pwa-delivery-cards">
                    {activeOrders.slice(0, 3).map((order, i) => (
                      <motion.button
                        key={order.id}
                        type="button"
                        className="pwa-delivery-card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.05 }}
                        onClick={() => navigate('/customer/deliveries', { state: { openOrderId: order.id } })}
                      >
                        <div className="pwa-delivery-card__top">
                          <span className="pwa-delivery-card__code">{order.tracking_code}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="pwa-delivery-card__route">
                          {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                )}

                {recentCompleted.length > 0 && (
                  <>
                    <h3 className="pwa-section__subtitle">Recent Deliveries</h3>
                    <div className="pwa-delivery-cards">
                      {recentCompleted.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          className="pwa-delivery-card pwa-delivery-card--muted"
                          onClick={() => navigate('/customer/history')}
                        >
                          <div className="pwa-delivery-card__top">
                            <span className="pwa-delivery-card__code">{order.tracking_code}</span>
                            <StatusBadge status={order.status} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <Link to="/customer/deliveries" className="btn-dx-secondary btn-sm" style={{ marginTop: 12 }}>
                  View all deliveries
                </Link>
              </>
            )}
          </section>
        )}

        <section className="pwa-section">
          <h2 className="pwa-section__title">Quick Actions</h2>
          <div className="pwa-action-grid">
            {(isCustomer
              ? [
                  ...guestActions.slice(0, 4),
                  { icon: Package, title: 'My Deliveries', description: 'Full delivery list', to: '/customer/deliveries' },
                  guestActions[4],
                  guestActions[5],
                  guestActions[6],
                ]
              : guestActions
            ).map((action) => (
              <CustomerActionCard key={action.title} {...action} />
            ))}
          </div>
        </section>
      </div>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}

export default CustomerHomePage
