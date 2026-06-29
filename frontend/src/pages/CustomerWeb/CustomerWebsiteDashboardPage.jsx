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
  ClipboardList,
  FileText,
  Link2,
  MessageSquarePlus,
  Package,
  Phone,
  Search,
  Truck,
  Users,
} from 'lucide-react'

const ACTIVE_STATUSES = new Set(['pending', 'assigned', 'dispatched', 'in_progress', 'en_route', 'arrived'])
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
    () => orders.filter((o) => ACTIVE_STATUSES.has(String(o.status || '').toLowerCase())),
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

  const completedCount = statusCounts.completed
  const podAvailableCount = useMemo(
    () => orders.filter((o) => o.status === 'completed' && Array.isArray(o.documents) && o.documents.length > 0).length,
    [orders],
  )

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

  const deliveryActions = [
    {
      icon: ClipboardList,
      title: 'My Deliveries',
      description: 'View all your ongoing and scheduled deliveries in progress.',
      to: paths.deliveries,
      badge: `${activeOrders.length} Active`,
      badgeVariant: 'blue',
    },
    {
      icon: FileText,
      title: 'Proof of Delivery',
      description: 'Download signed POD documents after delivery completion.',
      to: paths.deliveries,
      badge: podAvailableCount > 0 ? `${podAvailableCount} Available` : 'View deliveries',
      badgeVariant: 'purple',
    },
  ]

  const supportActions = [
    {
      icon: Link2,
      title: 'Link a Delivery',
      description: 'Connect a Tracking ID to your account for easier monitoring and access.',
      to: paths.linkDelivery,
      badge: 'Quick Link',
      badgeVariant: 'yellow',
    },
    {
      icon: MessageSquarePlus,
      title: 'Feedback & Concerns',
      description: 'Submit complaints or suggestions and track status.',
      to: paths.feedback,
      badge: 'Share feedback',
      badgeVariant: 'green',
    },
    {
      icon: Phone,
      title: 'Contact Support',
      description: 'Reach our team via phone, email, or submit an inquiry.',
      to: paths.support,
      badge: 'Get Help',
      badgeVariant: 'red',
    },
  ]

  if (user?.company_role === 'owner') {
    supportActions.push({
      icon: Users,
      title: 'Team',
      description: 'Manage company users and portal access.',
      to: paths.team,
      badge: 'Manage',
      badgeVariant: 'blue',
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
                  <Link to={paths.deliveries} className="customer-web-panel__link">View all deliveries</Link>
                </div>
                <div className="customer-web-delivery-grid">
                  {recentCompleted.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className="customer-web-delivery-card customer-web-delivery-card--muted"
                      onClick={() => navigate(paths.deliveries, { state: { openOrderId: order.id } })}
                    >
                      <div className="customer-web-delivery-card__top">
                        <span className="customer-web-delivery-card__code">{order.tracking_code}</span>
                        <StatusBadge status={order.status} />
                      </div>
                    </button>
                  ))}
                </div>
                {completedCount > 0 && (
                  <p className="customer-web-panel__meta">{completedCount} completed shipment{completedCount === 1 ? '' : 's'} on your account</p>
                )}
              </section>
            ) : null}
          </>
        )}

        <section className="customer-web-action-section" aria-labelledby="customer-deliveries-actions">
          <h2 id="customer-deliveries-actions" className="customer-web-action-section__title">My Deliveries</h2>
          <div className="customer-web-action-grid customer-web-action-grid--deliveries">
            {deliveryActions.map((action) => (
              <CustomerActionCard key={action.title} {...action} />
            ))}
          </div>
        </section>

        <section className="customer-web-action-section" aria-labelledby="customer-support-actions">
          <h2 id="customer-support-actions" className="customer-web-action-section__title">Support &amp; Account</h2>
          <div className="customer-web-action-grid customer-web-action-grid--support">
            {supportActions.map((action) => (
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
