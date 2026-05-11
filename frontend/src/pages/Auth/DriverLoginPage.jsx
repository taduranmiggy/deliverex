import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { login as loginRequest } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { roleHome } from '../../utils/roleUtils'
import { IconChevronLeft } from '../../components/DxIcons'
import './DriverLoginPage.css'

function DriverLoginPage() {
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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

    const payload = { email, password }

    try {
      const result = await loginRequest(payload)
      if (result.user?.role?.name !== 'driver') {
        setError('This portal is only for drivers. Use the main login for other roles.')
        return
      }
      login(result.user, result.token)
      const target = location.state?.from?.pathname || roleHome(result.user?.role?.name)
      navigate(target, { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="driver-login-page">
      <div className="driver-login-card">
        <Link to="/" className="driver-back-home">
          <IconChevronLeft />
          Back to home
        </Link>
        <h1 className="driver-login-brand">Deliverex</h1>
        <p className="driver-login-subtitle">Sign in to Deliverex</p>

        <form onSubmit={handleSubmit} className="driver-login-form">
          <div className="driver-field">
            <label htmlFor="driver-email">Email</label>
            <input
              id="driver-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="your.email@example.com"
              className={fieldErrors.email ? 'driver-input-invalid' : undefined}
              onChange={() => fieldErrors.email && setFieldErrors((e) => ({ ...e, email: undefined }))}
            />
            {fieldErrors.email ? (
              <span className="driver-field-msg driver-field-msg-error">{fieldErrors.email}</span>
            ) : null}
          </div>

          <div className="driver-field">
            <label htmlFor="driver-password">Password</label>
            <div className="driver-password-wrap">
              <input
                id="driver-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="driver-eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="driver-forgot"
            onClick={() => alert('Password recovery is not wired yet.')}
          >
            Forgot Password?
          </button>

          {error ? <p className="driver-banner-error">{error}</p> : null}

          <button type="submit" className="driver-btn-login">
            Log In
          </button>
        </form>

        <div className="driver-demo-panel">
          <div className="driver-demo-heading">Demo credentials:</div>
          <div className="driver-demo-line">
            Email: driver@deliverex.ph
            <br />
            Password: password
          </div>
        </div>

        <p className="driver-other-login">
          <Link to="/driver/signup">Create an account</Link>
          {' · '}
          <Link to="/login">Main login</Link>
        </p>
      </div>

      <p className="driver-footer-note">
        Deliverex Logistics – Provisional 6S & Site Preparation Services.
      </p>
    </section>
  )
}

export default DriverLoginPage
