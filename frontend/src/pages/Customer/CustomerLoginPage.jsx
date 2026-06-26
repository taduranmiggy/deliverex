import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login as loginRequest } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import { roleHome } from '../../utils/roleUtils'
import { isStandalonePwa } from '../../utils/pwaUtils'
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
        setError(
          isStandalonePwa()
            ? 'This app is for customer accounts only.'
            : 'This sign-in is for customer accounts only. Admin, manager, and dispatcher accounts should use Staff Login.',
        )
        return
      }
      await login(result.user, result.token, {
        expires_in: result.expires_in,
        session_id: result.session_id,
        refresh_token: result.refresh_token,
      })
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
        <h1>Customer sign in</h1>
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
      </div>
      <LoadingOverlay open={submitting} message="Signing in" submessage="Please wait." />
    </section>
  )
}

export default CustomerLoginPage
