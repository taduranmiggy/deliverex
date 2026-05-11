import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

function CustomerHomePage() {

  const { isAuthenticated, role, user } = useAuth()

  const isCustomer = isAuthenticated && role === 'customer'



  return (

    <section>

      <header className="page-header">

        <div className="header-stack">

          <h1>{isCustomer ? `Welcome${user?.name ? `, ${user.name}` : ''}` : 'Customer portal'}</h1>

          <p>Track deliveries with privacy-safe updates, or manage bookings linked to your account.</p>

        </div>

      </header>

      <div style={{ display: 'grid', gap: '16px', maxWidth: 520 }}>

        {!isCustomer ? (

          <div className="card">

            <h3>Accounts</h3>

            <p>Sign up to see shipments Dispatch links to your account, or track any job with only a tracking code.</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>

              <Link className="btn primary" to="/customer/signup">

                Create account

              </Link>

              <Link className="btn ghost" to="/login">

                Sign in

              </Link>

            </div>

          </div>

        ) : (

          <div className="card">

            <h3>Your shipments</h3>

            <p>View consolidated status for jobs booked under your email.</p>

            <Link className="btn primary" to="/customer/deliveries">

              Go to My deliveries

            </Link>

          </div>

        )}

        <div className="card">

          <h3>Track without signing in</h3>

          <p>Use your tracking ID to pull live status whenever you like.</p>

          <Link className="btn primary" to="/customer/track">

            Track a delivery

          </Link>

        </div>

      </div>

    </section>

  )

}



export default CustomerHomePage

