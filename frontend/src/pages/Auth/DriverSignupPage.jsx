import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../../components/DxIcons'
import './LoginPage.css'

function DriverSignupPage() {
  const [sent, setSent] = useState(false)
  const [pwError, setPwError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    setPwError('')
    const fd = new FormData(event.target)
    const a = String(fd.get('password') ?? '')
    const b = String(fd.get('password_confirm') ?? '')
    if (a !== b) {
      setPwError('Passwords must match.')
      return
    }
    setSent(true)
  }

  return (
    <section className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <Link to="/login" className="auth-back-home">
          <IconChevronLeft />
          Back to login
        </Link>
        <h1>Driver sign up</h1>
        <p className="auth-welcome auth-welcome--sub">
          Register your intent to onboard as a delivery driver. In production this form would sync with Dispatch and HR;
          here it confirms your details so we know you submitted.
        </p>

        {sent ? (
          <p className="auth-success-dx" role="status">
            Thanks—we received your sign up request. A coordinator will verify your credentials and invite you when your
            account is ready.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form-dx">
            <label>
              Full name
              <input name="name" type="text" autoComplete="name" placeholder="Maria Santos" required />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Mobile number
              <input name="phone" type="tel" autoComplete="tel" placeholder="+63 9XX XXX XXXX" required />
            </label>
            <label>
              Create password
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <label>
              Confirm password
              <input name="password_confirm" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            {pwError ? <p className="auth-error-dx">{pwError}</p> : null}
            <button className="btn-dx-login" type="submit">
              Submit registration
            </button>
          </form>
        )}

        <p className="auth-alt-link">
          Already registered?{' '}
          <Link to="/driver/login" className="auth-inline-link">
            Driver login
          </Link>
        </p>
      </div>
    </section>
  )
}

export default DriverSignupPage
