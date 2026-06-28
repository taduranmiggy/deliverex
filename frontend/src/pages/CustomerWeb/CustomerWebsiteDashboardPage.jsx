import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCustomerOrders } from '../../api/customer'
import DeliverexAssistantChat from '../../components/DeliverexAssistantChat'
import CustomerActionCard from '../../components/customer/CustomerActionCard'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import CustomerSkeleton from '../../components/customer/CustomerSkeleton'
import { StatusBadge } from '../../components/ui'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import useAuth from '../../hooks/useAuth'
import { buildDisplayAddress } from '../../utils/jobOrderHelpers'
import {
  BriefcaseBusiness,
  FileText,
  HeadphonesIcon,
  History,
  Info,
  Link2,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Truck,
  Users,
} from 'lucide-react'

const ACTIVE_STATUSES = ['pending', 'assigned', 'in_progress', 'arrived']
const NOTIFICATION_LABELS = {
  assigned: 'Assigned',
  in_progress: 'En Route',
  arrived: 'Arrived',
  completed: 'Delivered',
}

function CustomerWebsiteDashboardPage() {
  const { user } = useAuth()
  const { paths } = useCustomerSurface()
  const navigate = useNavigate()
  const [trackCode, setTrackCode] = useState('')
  const [trackError, setTrackError] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCustomerOrders()
      .then((res) => {
        if (!cancelled) {
          setOrders(res?.data ?? [])
          setOrdersLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrders([])
          setOrdersLoaded(true)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [orders],
  )
  const recentCompleted = useMemo(
    () => orders.filter((o) => o.status === 'completed').slice(0, 3),
    [orders],
  )
  const statusCounts = useMemo(() => {
    const counts = { assigned: 0, in_progress: 0, arrived: 0, completed: 0 }
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status] += 1
    })
    return counts
  }, [orders])

  const handleTrack = (e) => {
    e.preventDefault()
    const trimmed = trackCode.trim()
    if (!trimmed) {
      setTrackError('Enter your tracking ID to continue.')
      return
    }
    setTrackError('')
    navigate(paths.track, { state: { prefillTracking: trimmed } })
  }

  const quickActions = [
    { icon: MapPin, title: 'Track Delivery', description: 'Look up status by Tracking ID', to: paths.track },
    { icon: Package, title: 'My Deliveries', description: 'Full delivery list and details', to: paths.deliveries },
    { icon: History, title: 'Delivery History', description: 'Review past and active shipments', to: paths.history },
    { icon: FileText, title: 'Proof of Delivery', description: 'Access POD after completion', to: paths.track },
    { icon: Link2, title: 'Link Delivery', description: 'Connect a tracking ID to your account', to: paths.linkDelivery },
    { icon: HeadphonesIcon, title: 'Contact Support', description: 'Phone, email, and inquiries', to: paths.support },
    { icon: MessageSquare, title: 'Chat Assistant', description: 'Get instant help', onClick: () => setChatOpen(true) },
    { icon: Info, title: 'About Us', description: 'Learn about Deliverex', to: paths.about },
    { icon: BriefcaseBusiness, title: 'Our Services', description: 'Logistics solutions we offer', to: paths.services },
  ]

  if (user?.company_role === 'owner') {
    quickActions.splice(5, 0, {
      icon: Users,
      title: 'Team',
      description: 'Manage company users',
      to: paths.team,
    })
  }

  return (
    <CustomerPageShell className="customer-web-dashboard">
      <section className="customer-web-hero" aria-labelledby="customer-web-hero-title">
        <div className="customer-web-hero__inner">
          <p className="customer-web-hero__eyebrow">Welcome back</p>
          <h1 id="customer-web-hero-title" className="customer-web-hero__title">
            Hi, {user?.name?.split(' ')[0] ?? 'Customer'}
          </h1>
          <p className="customer-web-hero__subtitle">
            {user?.company_name
              ? `${user.company_name} · Track shipments, view ETAs, and access proof of delivery.`
              : 'Track shipments, view ETAs, and access proof of delivery.'}
          </p>

          <form className="customer-web-hero-track" onSubmit={handleTrack} noValidate>
            <label className="sr-only" htmlFor="customer-web-track-id">Tracking ID</label>
            <div className={`customer-web-hero-track__field${trackError ? ' customer-web-hero-track__field--invalid' : ''}`}>
              <Search size={18} className="customer-web-hero-track__icon" aria-hidden />
              <input
                id="customer-web-track-id"
                type="text"
                value={trackCode}
                onChange={(e) => {
                  setTrackCode(e.target.value)
                  if (trackError) setTrackError('')
                }}
                placeholder="Enter tracking ID, e.g. XKFP2NQRLA"
                autoComplete="off"
                aria-invalid={Boolean(trackError)}
                aria-describedby={trackError ? 'customer-web-track-error' : undefined}
              />
            </div>
            <button type="submit" className="btn-dx-primary customer-web-hero-track__btn">
              Track Delivery
            </button>
          </form>
          {trackError ? (
            <p id="customer-web-track-error" className="customer-web-hero-track__error" role="alert">{trackError}</p>
          ) : (
            <p className="customer-web-hero-track__hint">Enter the ID from your dispatcher or delivery receipt.</p>
          )}
        </div>
      </section>

      <div className="customer-container customer-web-dashboard__body">
        <CustomerPageHeader
          eyebrow="Dashboard"
          title="Your deliveries at a glance"
          description="Overview of shipments linked to your account."
        />

        {loading && !ordersLoaded ? (
          <CustomerSkeleton variant="stat" count={4} />
        ) : (
          <>
            <div className="customer-web-status-chips">
              {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
                <span
                  key={key}
                  className={`pwa-notif-chip${statusCounts[key] > 0 ? ' pwa-notif-chip--active' : ''}`}
                >
                  <Truck size={14} />
                  {label}
                  <strong>{statusCounts[key]}</strong>
                </span>
              ))}
            </div>

            <section className="customer-web-panel">
              <div className="customer-web-panel__head">
                <h2>Active deliveries</h2>
                <Link to={paths.deliveries} className="customer-web-panel__link">View all</Link>
              </div>
              {activeOrders.length === 0 ? (
                <div className="customer-web-empty">
                  <Package size={28} aria-hidden />
                  <p>No active deliveries right now.</p>
                  <div className="customer-web-empty__actions">
                    <Link to={paths.track} className="btn-dx-primary btn-sm">Track by ID</Link>
                    <Link to={paths.linkDelivery} className="btn-dx-secondary btn-sm">Link delivery</Link>
                  </div>
                </div>
              ) : (
                <div className="customer-web-delivery-grid">
                  {activeOrders.slice(0, 4).map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className="customer-web-delivery-card"
                      onClick={() => navigate(paths.deliveries, { state: { openOrderId: order.id } })}
                    >
                      <div className="customer-web-delivery-card__top">
                        <span className="customer-web-delivery-card__code">{order.tracking_code}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="customer-web-delivery-card__route">
                        {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {recentCompleted.length > 0 ? (
              <section className="customer-web-panel">
                <div className="customer-web-panel__head">
                  <h2>Recently completed</h2>
                  <Link to={paths.history} className="customer-web-panel__link">View history</Link>
                </div>
                <div className="customer-web-delivery-grid">
                  {recentCompleted.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className="customer-web-delivery-card customer-web-delivery-card--muted"
                      onClick={() => navigate(paths.history)}
                    >
                      <div className="customer-web-delivery-card__top">
                        <span className="customer-web-delivery-card__code">{order.tracking_code}</span>
                        <StatusBadge status={order.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        <section className="customer-web-panel">
          <div className="customer-web-panel__head">
            <h2>Quick actions</h2>
          </div>
          <div className="customer-web-action-grid">
            {quickActions.map((action) => (
              <CustomerActionCard key={action.title} {...action} />
            ))}
          </div>
        </section>
      </div>

      <DeliverexAssistantChat open={chatOpen} onOpenChange={setChatOpen} />
    </CustomerPageShell>
  )
}

export default CustomerWebsiteDashboardPage
