import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { activateCompany, fetchCompanyActivation } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { Eye, EyeOff } from 'lucide-react'
import './LoginPage.css'

const PASSWORD_RULES = [
  { key: 'length', label: 'Minimum 8 characters', test: (value) => value.length >= 8 },
  { key: 'upper', label: 'Uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { key: 'lower', label: 'Lowercase letter', test: (value) => /[a-z]/.test(value) },
  { key: 'number', label: 'Number', test: (value) => /\d/.test(value) },
  { key: 'special', label: 'Special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

function computePasswordStrength(value) {
  if (!value) return { score: 0, label: 'Weak', tone: 'weak' }
  const score = PASSWORD_RULES.reduce((acc, rule) => acc + (rule.test(value) ? 1 : 0), 0)
  if (score <= 2) return { score, label: 'Weak', tone: 'weak' }
  if (score === 3) return { score, label: 'Fair', tone: 'fair' }
  if (score === 4) return { score, label: 'Good', tone: 'good' }
  return { score, label: 'Strong', tone: 'strong' }
}

function CompanyActivationPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchCompanyActivation(token)
        if (!cancelled) setInfo(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const ruleStates = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) })),
    [password],
  )
  const strength = useMemo(() => computePasswordStrength(password), [password])
  const allPasswordRulesPassed = useMemo(
    () => ruleStates.every((rule) => rule.ok),
    [ruleStates],
  )
  const passwordsMatch = passwordConfirmation.length > 0 && password === passwordConfirmation
  const passwordsMismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!allPasswordRulesPassed) {
      setError('Password does not meet all required rules.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await activateCompany(token, {
        password,
        password_confirmation: passwordConfirmation,
      })
      await login(res.user, res.access_token || res.token, {
        expires_in: res.expires_in,
        session_id: res.session_id,
        refresh_token: res.refresh_token,
      })
      navigate('/customer', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx"><p>Validating activation link…</p></div>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Activation unavailable</h1>
          <p className="notice error">{error}</p>
          <p><Link to="/login">Return to sign in</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <h1>Activate company account</h1>
        <p className="auth-welcome auth-welcome--sub">
          Set a password for <strong>{info?.company_name}</strong> ({info?.company_email}).
        </p>
        <form onSubmit={handleSubmit} className="auth-form-dx auth-activation-form" noValidate>
          <label className="auth-password-row auth-password-row--activation">
            <span>Password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby="activation-password-rules activation-password-strength"
            />
            <button
              type="button"
              className="auth-toggle-pw"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>

          <div id="activation-password-strength" className="activation-strength">
            <div className="activation-strength__bar-wrap" aria-hidden="true">
              <span className={`activation-strength__bar activation-strength__bar--${strength.tone} activation-strength__bar--fill-${strength.score}`} />
            </div>
            <p className={`activation-strength__label activation-strength__label--${strength.tone}`}>
              Password strength: <strong>{strength.label}</strong>
            </p>
          </div>

          <ul id="activation-password-rules" className="activation-rules" aria-live="polite">
            {ruleStates.map((rule) => (
              <li key={rule.key} className={rule.ok ? 'is-complete' : ''}>
                <span aria-hidden="true">{rule.ok ? '✔' : '○'}</span>
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>

          <label className="auth-password-row auth-password-row--activation">
            <span>Confirm password</span>
            <input
              type={showPasswordConfirmation ? 'text' : 'password'}
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby="activation-password-match"
            />
            <button
              type="button"
              className="auth-toggle-pw"
              aria-label={showPasswordConfirmation ? 'Hide confirm password' : 'Show confirm password'}
              aria-pressed={showPasswordConfirmation}
              onClick={() => setShowPasswordConfirmation((prev) => !prev)}
            >
              {showPasswordConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>

          <p id="activation-password-match" className={`activation-match ${passwordsMatch ? 'is-match' : passwordsMismatch ? 'is-mismatch' : ''}`} aria-live="polite">
            {passwordsMatch ? '✔ Passwords match' : passwordsMismatch ? '✖ Passwords do not match' : 'Passwords must match'}
          </p>

          {error && <p className="notice error">{error}</p>}
          <button type="submit" className="btn-dx-login" disabled={submitting}>
            {submitting ? 'Activating…' : 'Activate & sign in'}
          </button>
        </form>
        <p className="auth-alt-link">
          Need help? <Link to="/login">Return to sign in</Link>.
        </p>
      </div>
    </div>
  )
}

export default CompanyActivationPage
