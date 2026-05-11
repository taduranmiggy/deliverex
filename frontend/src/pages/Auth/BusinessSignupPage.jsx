import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../../components/DxIcons'
import './LoginPage.css'

function BusinessSignupPage() {
  const [sent, setSent] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    setSent(true)
  }

  return (
    <section className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <Link to="/login" className="auth-back-home">
          <IconChevronLeft />
          Back to login
        </Link>
        <h1>Business sign up</h1>
        <p className="auth-welcome auth-welcome--sub">
          Tell us about your company so we can set up bookings, invoicing, and tracking. No payment is collected on this
          demo—submit your details and we will follow up.
        </p>

        {sent ? (
          <p className="auth-success-dx" role="status">
            Thank you. Our sales desk will reach out with next steps for your Deliverex shipper account.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form-dx">
            <label>
              Company name
              <input name="company" type="text" autoComplete="organization" placeholder="ACME Construction Inc." required />
            </label>
            <label>
              Contact person
              <input name="contact" type="text" autoComplete="name" placeholder="Full name" required />
            </label>
            <label>
              Work email
              <input name="email" type="email" autoComplete="email" placeholder="ops@company.com" required />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" placeholder="+63 2 XXX XXXX" required />
            </label>
            <label>
              Monthly shipment volume (optional)
              <select name="volume" defaultValue="">
                <option value="" disabled>
                  Select a range
                </option>
                <option value="light">1–20 loads / month</option>
                <option value="medium">21–100 loads / month</option>
                <option value="heavy">100+ loads / month</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                name="notes"
                rows={3}
                placeholder="Routes, materials, or compliance needs…"
              />
            </label>
            <button className="btn-dx-login" type="submit">
              Request business account
            </button>
          </form>
        )}

        <p className="auth-alt-link">
          Just tracking a shipment?{' '}
          <Link to="/track" className="auth-inline-link">
            Track a delivery
          </Link>
        </p>
      </div>
    </section>
  )
}

export default BusinessSignupPage
