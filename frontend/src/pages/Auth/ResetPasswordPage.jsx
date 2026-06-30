import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { fetchPasswordResetContext, resetPassword } from '../../api/auth'
import {
  allPasswordRulesPassed,
  computePasswordStrength,
  passwordRuleStates,
} from '../../utils/passwordValidation'
import { isStandalonePwa } from '../../utils/pwaUtils'
import './LoginPage.css'

const BLANK_ADDRESS = {
  street: '',
  barangay: '',
  city: '',
  province: '',
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const loginPath = useMemo(
    () => (isStandalonePwa() ? '/customer/login' : '/login'),
    [],
  )
  const forgotPath = useMemo(
    () => (isStandalonePwa() ? '/customer/forgot-password' : '/forgot-password'),
    [],
  )

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [companyAddress, setCompanyAddress] = useState(BLANK_ADDRESS)
  const [context, setContext] = useState(null)
  const [loadingContext, setLoadingContext] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  useEffect(() => {
    if (!token || !email) {
      setLoadingContext(false)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchPasswordResetContext({ email, token })
        if (!cancelled) setContext(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoadingContext(false)
      }
    })()

    return () => { cancelled = true }
  }, [email, token])

  const needsCompanyAddress = Boolean(context?.needs_company_address)
  const ruleStates = useMemo(() => passwordRuleStates(password), [password])
  const strength = useMemo(() => computePasswordStrength(password), [password])
  const passwordsMatch = passwordConfirmation.length > 0 && password === passwordConfirmation
  const passwordsMismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation

  const setAddress = (key) => (e) => {
    setCompanyAddress((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!allPasswordRulesPassed(password)) {
      setError('Password does not meet all required rules.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }
    if (!token || !email) {
      setError('Invalid or expired reset link.')
      return
    }

    if (needsCompanyAddress) {
      const missing = ['street', 'barangay', 'city', 'province'].filter((k) => !companyAddress[k]?.trim())
      if (missing.length) {
        setError('Complete company address is required before activating your account.')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      }
      if (needsCompanyAddress) {
        payload.company_address = {
          street: companyAddress.street.trim(),
          barangay: companyAddress.barangay.trim(),
          city: companyAddress.city.trim(),
          province: companyAddress.province.trim(),
        }
      }

      await resetPassword(payload)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Password updated</h1>
          <p className="auth-success-dx">
            Your password has been successfully updated.
          </p>
          <button
            type="button"
            className="btn-dx-login"
            onClick={() => navigate(loginPath, { replace: true })}
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (!token || !email) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Reset link invalid</h1>
          <p className="auth-error-dx">This password reset link is missing required information or has expired.</p>
          <p className="auth-alt-link">
            <Link to={forgotPath}>
              Request a new reset link
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (loadingContext) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx"><p>Validating reset link…</p></div>
      </div>
    )
  }

  if (error && !context) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Reset unavailable</h1>
          <p className="auth-error-dx">{error}</p>
          <p className="auth-alt-link" style={{ marginTop: 16 }}>
            <Link to={forgotPath}>Request a new reset link</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <h1>{needsCompanyAddress ? 'Activate your account' : 'Create new password'}</h1>
        <p className="auth-welcome auth-welcome--sub">
          {needsCompanyAddress ? (
            <>Set your password and company address for <strong>{context?.company_name}</strong>.</>
          ) : (
            <>Set a new password for <strong>{email}</strong>.</>
          )}
        </p>
        <form onSubmit={handleSubmit} className="auth-form-dx auth-activation-form" noValidate>
          {needsCompanyAddress && (
            <div className="auth-form-section">
              <p className="auth-form-section__title">Company address</p>
              <label>
                Street / building / site
                <input required value={companyAddress.street} onChange={setAddress('street')} />
              </label>
              <label>
                Barangay
                <input required value={companyAddress.barangay} onChange={setAddress('barangay')} />
              </label>
              <label>
                City / municipality
                <input required value={companyAddress.city} onChange={setAddress('city')} />
              </label>
              <label>
                Province
                <input required value={companyAddress.province} onChange={setAddress('province')} />
              </label>
            </div>
          )}

          <label className="auth-password-row auth-password-row--activation">
            <span>New password</span>
            <div className="auth-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="reset-password-rules reset-password-strength"
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
            </div>
          </label>

          <div id="reset-password-strength" className="activation-strength">
            <div className="activation-strength__bar-wrap" aria-hidden="true">
              <span className={`activation-strength__bar activation-strength__bar--${strength.tone} activation-strength__bar--fill-${strength.score}`} />
            </div>
            <p className={`activation-strength__label activation-strength__label--${strength.tone}`}>
              Password strength: <strong>{strength.label}</strong>
            </p>
          </div>

          <ul id="reset-password-rules" className="activation-rules" aria-live="polite">
            {ruleStates.map((rule) => (
              <li key={rule.key} className={rule.ok ? 'is-complete' : ''}>
                <span aria-hidden="true">{rule.ok ? '✔' : '○'}</span>
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>

          <label className="auth-password-row auth-password-row--activation">
            <span>Confirm new password</span>
            <div className="auth-password-field">
              <input
                type={showPasswordConfirmation ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                aria-describedby="reset-password-match"
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
            </div>
          </label>

          <p
            id="reset-password-match"
            className={`activation-match ${passwordsMatch ? 'is-match' : passwordsMismatch ? 'is-mismatch' : ''}`}
            aria-live="polite"
          >
            {passwordsMatch ? '✔ Passwords match' : passwordsMismatch ? '✖ Passwords do not match' : 'Passwords must match'}
          </p>

          {error ? <p className="auth-error-dx">{error}</p> : null}
          <button className="btn-dx-login" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : needsCompanyAddress ? 'Activate account' : 'Update password'}
          </button>
        </form>
        <p className="auth-alt-link" style={{ marginTop: 16 }}>
          <Link to={loginPath}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default ResetPasswordPage
