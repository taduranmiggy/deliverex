import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { login as loginRequest } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { roleHome } from '../../utils/roleUtils'
import { isStandalonePwa } from '../../utils/pwaUtils'
import { Truck } from 'lucide-react'
import '../../styles/driver-app.css'
import './DriverLoginPage.css'

function DriverLoginPage() {
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (isStandalonePwa()) {
    return <Navigate to="/customer/login" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.target)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const nextErrors = {}
    if (!email) nextErrors.email = 'Email is required'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const result = await loginRequest({ email, password })
      if (result.user?.role?.name !== 'driver') {
        setError('This portal is only for drivers.')
        return
      }
      login(result.user, result.token)
      const target = result.user?.must_change_password
        ? '/driver/change-password'
        : location.state?.from?.pathname || roleHome(result.user?.role?.name)
      navigate(target, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="driver-native-login">
      <div className="driver-native-login__hero">
        <div className="driver-native-login__logo">
          <Truck size={36} color="#fff" />
        </div>
        <h1>Deliverex</h1>
        <p>Driver logistics app</p>
      </div>

      <div className="driver-native-login__card">
        <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800 }}>Sign in</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--da-muted, #64748b)', fontSize: '0.875rem' }}>
          Access your deliveries and routes
        </p>

        <form onSubmit={handleSubmit} className="driver-login-form">
          <div className="driver-field">
            <label htmlFor="driver-email">Email</label>
            <input
              id="driver-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="driver@deliverex.ph"
              className={fieldErrors.email ? 'driver-input-invalid' : undefined}
              onChange={() => fieldErrors.email && setFieldErrors((e) => ({ ...e, email: undefined }))}
            />
            {fieldErrors.email && (
              <span className="driver-field-msg driver-field-msg-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className="driver-field">
            <label htmlFor="driver-password">Password</label>
            <div className="driver-password-wrap">
              <input
                id="driver-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="driver-eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <p className="da-alert da-alert--error">{error}</p>}

          <button type="submit" className="driver-btn-login" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Log In'}
          </button>
        </form>

        <div className="driver-demo-panel">
          <div className="driver-demo-heading">Demo account</div>
          <div className="driver-demo-line">
            driver@deliverex.ph / driver123
          </div>
        </div>

        <p className="driver-other-login">
          <Link to="/driver/signup">Create account</Link>
          {' · '}
          <Link to="/login">Main login</Link>
        </p>
      </div>
    </div>
  )
}

export default DriverLoginPage
