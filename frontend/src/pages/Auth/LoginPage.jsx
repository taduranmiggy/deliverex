import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { login as loginRequest } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { roleHome } from '../../utils/roleUtils'
import { IconChevronLeft, IconLockOutlined, IconMail } from '../../components/DxIcons'
import './LoginPage.css'

const ASIDE_SLIDES = [
  {
    title: 'Connect dispatch, drivers, and customers.',
    subtitle: 'Everything you need to run deliveries in one clear, customizable workflow.',
  },
  {
    title: 'Proof and tracking you can rely on.',
    subtitle: 'ETAs, status updates, and delivery documents when your team needs them.',
  },
  {
    title: 'Built for field and office teams alike.',
    subtitle: 'Managers, dispatchers, and drivers stay aligned—without noisy handoffs.',
  },
]

function AsideArt() {
  return (
    <svg className="auth-split-art" viewBox="0 0 360 240" role="img" aria-labelledby="aside-art-title">
      <title id="aside-art-title">Stylized connections between fleet apps and Deliverex dashboard</title>
      <defs>
        <linearGradient id="authArtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.75)" />
        </linearGradient>
      </defs>
      <circle cx="180" cy="120" r="118" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
      <circle cx="180" cy="120" r="88" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <g fill="url(#authArtGrad)">
        <circle cx="72" cy="88" r="22" opacity="0.95" />
        <circle cx="56" cy="158" r="18" opacity="0.88" />
        <circle cx="108" cy="172" r="16" opacity="0.82" />
      </g>
      <path
        d="M94 92 L168 104 M78 154 L174 126 M118 164 L178 134"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="178" y="72" width="132" height="96" rx="10" fill="rgba(255,255,255,0.92)" />
      <rect x="194" y="88" width="56" height="8" rx="2" fill="#2d54b7" opacity="0.85" />
      <rect x="194" y="104" width="100" height="6" rx="2" fill="#94a3b8" opacity="0.55" />
      <rect x="194" y="118" width="76" height="6" rx="2" fill="#94a3b8" opacity="0.4" />
      <rect x="194" y="136" width="48" height="22" rx="4" fill="#2d54b7" opacity="0.2" />
    </svg>
  )
}

function LoginPage() {
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [slide, setSlide] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const emailId = useId()
  const passwordId = useId()

  useEffect(() => {
    const t = window.setInterval(() => {
      setSlide((s) => (s + 1) % ASIDE_SLIDES.length)
    }, 6200)
    return () => window.clearInterval(t)
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.target)
    const payload = {
      email: formData.get('email'),
      password: formData.get('password'),
    }

    try {
      const result = await loginRequest(payload)
      const roleName = result.user?.role?.name
      if (roleName === 'driver') {
        setError('Driver accounts use the Deliverex driver mobile app — not this sign-in page.')
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
    }
  }

  return (
    <div className="auth-split-root">
      <section className="auth-split-layout" aria-label="Sign in">
        <div className="auth-split-form-col">
          <div className="auth-split-form-inner">
            <Link to="/" className="auth-back-home auth-back-home--split">
              <IconChevronLeft />
              Back to home
            </Link>

            <div className="auth-brand-lockup">
              <span className="auth-brand-logo" aria-hidden />
              <span className="auth-brand-text">Deliverex</span>
            </div>

            <h1 className="auth-split-title">Sign in</h1>
            <p className="auth-split-lead">Admin, manager, dispatcher, and customer accounts use this page.</p>

            <form onSubmit={handleSubmit} className="auth-form-split" noValidate>
              <div className="auth-field-split">
                <label htmlFor={emailId}>Email</label>
                <div className="auth-input-shell">
                  <span className="auth-input-icon">
                    <IconMail />
                  </span>
                  <input
                    id={emailId}
                    name="email"
                    type="email"
                    className="auth-input-control"
                    placeholder="Email"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="auth-field-split auth-field-split--password">
                <label htmlFor={passwordId}>Password</label>
                <div className="auth-input-shell">
                  <span className="auth-input-icon">
                    <IconLockOutlined />
                  </span>
                  <input
                    id={passwordId}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input-control"
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pw auth-toggle-pw--split"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="auth-form-options-row">
                <label className="auth-remember-label">
                  <input type="checkbox" name="remember" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="auth-forgot-plain">
                  Forgot Password?
                </button>
              </div>

              {error ? <p className="auth-error-dx auth-error-split">{error}</p> : null}
              <button className="auth-btn-submit" type="submit">
                Log In
              </button>
            </form>

            <div className="auth-demo-dx auth-demo-split">
              <strong>Demo credentials:</strong>
              <div>Admin: admin@deliverex.com / admin123</div>
              <div>Dispatcher: dispatcher@deliverex.com / dispatcher123</div>
              <div>Manager: manager@deliverex.com / manager123</div>
              <div>Customer: customer@deliverex.com / customer123</div>
            </div>
            <p className="auth-alt-link" style={{ marginTop: 16, color: 'var(--muted)' }}>
              B2B company accounts are provisioned by an administrator.
            </p>
          </div>
        </div>

        <aside className="auth-split-aside-col" aria-label="Deliverex highlights">
          <div className="auth-split-aside-pattern" aria-hidden />
          <div className="auth-split-aside-content">
            <AsideArt />
            <div className="auth-aside-copy">
              <h2 className="auth-aside-title">{ASIDE_SLIDES[slide].title}</h2>
              <p className="auth-aside-sub">{ASIDE_SLIDES[slide].subtitle}</p>
            </div>
            <div className="auth-aside-dots">
              {ASIDE_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`auth-aside-dot${i === slide ? ' auth-aside-dot--active' : ''}`}
                  aria-label={`Slide ${i + 1}${i === slide ? ', current' : ''}`}
                  aria-current={i === slide ? 'true' : undefined}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          </div>
        </aside>
      </section>
      <p className="auth-footer-tagline auth-footer-split">Deliverex Logistics – Providential 628 Site Preparation Services.</p>
    </div>
  )
}

export default LoginPage
