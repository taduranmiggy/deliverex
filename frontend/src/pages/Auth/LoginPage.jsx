import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { login as loginRequest } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { roleHome } from '../../utils/roleUtils'
import { IconChevronLeft, IconChevronRight, IconLockOutlined, IconMail } from '../../components/DxIcons'
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

function GoogleGlyph() {
  return (
    <svg className="auth-social-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function FacebookGlyph() {
  return (
    <svg className="auth-social-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  )
}

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
      {/* left nodes */}
      <g fill="url(#authArtGrad)">
        <circle cx="72" cy="88" r="22" opacity="0.95" />
        <circle cx="56" cy="158" r="18" opacity="0.88" />
        <circle cx="108" cy="172" r="16" opacity="0.82" />
      </g>
      {/* connector lines */}
      <path
        d="M94 92 L168 104 M78 154 L174 126 M118 164 L178 134"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* dashboard */}
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
  const [socialNotice, setSocialNotice] = useState('')
  const [slide, setSlide] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const emailId = useId()
  const passwordId = useId()

  useEffect(() => {
    if (!socialNotice) return
    const tid = window.setTimeout(() => setSocialNotice(''), 5000)
    return () => window.clearTimeout(tid)
  }, [socialNotice])


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
      login(result.user, result.token)
      const target = location.state?.from?.pathname || roleHome(result.user?.role?.name)
      navigate(target, { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const socialUnavailable = () => {
    setSocialNotice('Social login is not connected in this demo. Use your email and password below.')
  }

  return (
    <div className="auth-split-root">
      <section className="auth-split-layout" aria-label="Sign in">
        <div className="auth-split-form-col">
          <div className="auth-split-form-inner">
            <Link to="/customer" className="auth-back-home auth-back-home--split">
              <IconChevronLeft />
              Back to home
            </Link>

            <div className="auth-brand-lockup">
              <span className="auth-brand-logo" aria-hidden />
              <span className="auth-brand-text">Deliverex</span>
            </div>

            <h1 className="auth-split-title">Log in to your Account</h1>
            <p className="auth-split-lead">Welcome back! Select method to log in:</p>

            <div className="auth-social-row">
              <button type="button" className="auth-social-btn" onClick={socialUnavailable}>
                <GoogleGlyph />
                Google
              </button>
              <button type="button" className="auth-social-btn" onClick={socialUnavailable}>
                <FacebookGlyph />
                Facebook
              </button>
            </div>

            {socialNotice ? (
              <p className="auth-split-notice" role="status">
                {socialNotice}
              </p>
            ) : null}


            <div className="auth-split-divider">
              <span>or continue with email</span>
            </div>

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
              <div className="auth-demo-driver">
                <Link to="/driver/login" className="auth-driver-login-link">
                  Driver login (driver@deliverex.ph / driver123)
                  <IconChevronRight />
                </Link>
              </div>
            </div>
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
