import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchAccountActivationContext, resetPassword } from '../../api/auth'
import PasswordFieldsForm, { allPasswordRulesPassed } from '../../components/auth/PasswordFieldsForm'
import { isStandalonePwa } from '../../utils/pwaUtils'
import './LoginPage.css'

const BLANK_ADDRESS = {
  street: '',
  barangay: '',
  city: '',
  province: '',
}

function AccountActivationPage() {
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
  const [success, setSuccess] = useState(false)

  const needsCompanyAddress = Boolean(context?.needs_company_address)

  useEffect(() => {
    if (!token || !email) {
      setLoadingContext(false)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchAccountActivationContext({ email, token })
        if (!cancelled) setContext(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoadingContext(false)
      }
    })()

    return () => { cancelled = true }
  }, [email, token])

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
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.')
      return
    }
    if (!token || !email) {
      setError('Invalid or expired activation link.')
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

  if (!token || !email) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Activation link invalid</h1>
          <p className="auth-error-dx">This activation link is missing required information or has expired.</p>
          <p className="auth-alt-link">
            <Link to={loginPath}>Back to sign in</Link>
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
          <p className="auth-alt-link" style={{ marginTop: 16 }}>
            Need help? Contact your administrator to request a new activation link.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Account activated</h1>
          <p className="auth-success-dx">
            Your account has been activated. You can now sign in.
          </p>
          <button
            type="button"
            className="btn-dx-login"
            onClick={() => navigate(loginPath, { replace: true })}
          >
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <h1>Activate your account</h1>
        <p className="auth-welcome auth-welcome--sub">
          {needsCompanyAddress ? (
            <>Set your password and company address for <strong>{context?.company_name}</strong>.</>
          ) : (
            <>Set your password to activate your Deliverex account for <strong>{email}</strong>.</>
          )}
        </p>
        <form onSubmit={handleSubmit} className="auth-form-dx auth-activation-form" noValidate>
          {needsCompanyAddress ? (
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
          ) : null}

          <PasswordFieldsForm
            idPrefix="activation-password"
            password={password}
            passwordConfirmation={passwordConfirmation}
            onPasswordChange={setPassword}
            onPasswordConfirmationChange={setPasswordConfirmation}
            newPasswordLabel="Password"
            confirmLabel="Confirm password"
          />

          {error ? <p className="auth-error-dx">{error}</p> : null}
          <button className="btn-dx-login" type="submit" disabled={submitting}>
            {submitting ? 'Activating…' : 'Activate account'}
          </button>
        </form>
        <p className="auth-alt-link" style={{ marginTop: 16 }}>
          <Link to={loginPath}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default AccountActivationPage
