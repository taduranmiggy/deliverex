import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

function CustomerHomePage() {

  const { isAuthenticated, role, user } = useAuth()

  const isCustomer = isAuthenticated && role === 'customer'



  return (
    <section className="customer-portal" aria-labelledby="customer-portal-title">
      <header className="page-header">
        <div className="header-stack">
          <p className="customer-portal__eyebrow">Customer portal</p>
          <h1 id="customer-portal-title">
            {isCustomer ? `Welcome${user?.name ? `, ${user.name}` : ''}` : 'Manage your deliveries'}
          </h1>
          <p>
            Track deliveries with privacy-safe updates, or manage bookings linked to your account.
          </p>
        </div>
      </header>

      <div className="customer-portal__grid" role="list">
        {!isCustomer ? (
          <article className="card customer-card" role="listitem" aria-labelledby="customer-accounts-title">
            <div className="customer-card__meta">
              <p className="customer-card__kicker">Accounts</p>
              <h3 id="customer-accounts-title">Create an account to save your deliveries</h3>
              <p>
                Sign up to see shipments linked to your email, manage bookings, and get delivery alerts.
              </p>
            </div>
            <div className="customer-card__actions">
              <Link className="btn primary" to="/customer/signup">
                Create account
              </Link>
              <Link className="btn ghost" to="/login">
                Sign in
              </Link>
            </div>
          </article>
        ) : (
          <article className="card customer-card" role="listitem" aria-labelledby="customer-shipments-title">
            <div className="customer-card__meta">
              <p className="customer-card__kicker">Your account</p>
              <h3 id="customer-shipments-title">View shipments linked to your email</h3>
              <p>See a consolidated status view and delivery history in one place.</p>
            </div>
            <div className="customer-card__actions">
              <Link className="btn primary" to="/customer/deliveries">
                Go to My deliveries
              </Link>
            </div>
          </article>
        )}

        <article
          className="card customer-card customer-card--highlight"
          role="listitem"
          aria-labelledby="customer-track-title"
        >
          <div className="customer-card__meta">
            <p className="customer-card__kicker">Quick track</p>
            <h3 id="customer-track-title">Track without signing in</h3>
            <p>Use your tracking ID to pull live status, ETA, and proof-of-delivery updates.</p>
          </div>
          <div className="customer-card__actions">
            <Link className="btn primary" to="/customer/track">
              Track a delivery
            </Link>
          </div>
          <p className="customer-card__hint">Have a tracking code ready.</p>
        </article>
      </div>
    </section>
  )

}



export default CustomerHomePage

