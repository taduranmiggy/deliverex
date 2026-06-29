import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchPasswordResetContext, resetPassword } from '../../api/auth'
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

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [companyAddress, setCompanyAddress] = useState(BLANK_ADDRESS)
  const [context, setContext] = useState(null)
  const [loadingContext, setLoadingContext] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const setAddress = (key) => (e) => {
    setCompanyAddress((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== passwordConfirmation) {
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
      navigate(loginPath, {
        replace: true,
        state: { notice: 'Account activated. Sign in with your new password.' },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Reset link invalid</h1>
          <p className="auth-error-dx">This password reset link is missing required information or has expired.</p>
          <p className="auth-alt-link">
            <Link to={isStandalonePwa() ? '/customer/forgot-password' : '/login'}>
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
        <div className="auth-card auth-card--dx"><p>Validating activation link…</p></div>
      </div>
    )
  }

  if (error && !context) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Activation unavailable</h1>
          <p className="auth-error-dx">{error}</p>
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
        <form onSubmit={handleSubmit} className="auth-form-dx">
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

          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
          </label>
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
