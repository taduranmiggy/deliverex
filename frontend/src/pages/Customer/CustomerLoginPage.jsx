import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login as loginRequest } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { roleHome } from '../../utils/roleUtils'
import '../Auth/LoginPage.css'

function CustomerLoginPage() {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = location.state?.notice

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.target)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    setSubmitting(true)
    try {
      const result = await loginRequest({ email, password })
      const roleName = result.user?.role?.name
      if (roleName !== 'customer') {
        setError('This app is for customers only. Staff and drivers should sign in through a web browser.')
        return
      }
      login(result.user, result.token)
      const target = location.state?.from?.pathname || roleHome(roleName)
      navigate(target, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <Link to="/customer" className="auth-back-home">
          ← Back to customer home
        </Link>
        <h1>Sign in</h1>
        <p className="auth-welcome auth-welcome--sub">
          Access your deliveries, link tracking IDs, and manage your shipments.
        </p>

        {notice ? <p className="auth-success-dx">{notice}</p> : null}

        <form onSubmit={handleSubmit} className="auth-form-dx">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required placeholder="Enter password" />
          </label>
          {error ? <p className="auth-error-dx">{error}</p> : null}
          <button className="btn-dx-login" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-demo-dx" style={{ marginTop: 16 }}>
          <strong>Demo customer:</strong>
          <div>customer@deliverex.com / customer123</div>
        </div>

        <p className="auth-alt-link">
          No account yet?{' '}
          <Link className="auth-inline-link" to="/customer/signup">
            Create account
          </Link>
        </p>
        <p className="auth-alt-link" style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--muted)' }}>
          Drivers and staff: open <strong>deliverexapp.com/driver</strong> or <strong>/login</strong> in your mobile browser — not this app.
        </p>
      </div>
    </section>
  )
}

export default CustomerLoginPage
