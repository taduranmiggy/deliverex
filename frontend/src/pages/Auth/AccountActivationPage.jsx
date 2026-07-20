import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchAccountActivationContext, resetPassword } from '../../api/auth'
import PasswordFieldsForm, { allPasswordRulesPassed } from '../../components/auth/PasswordFieldsForm'
import PsgcAddressSelector from '../../components/PsgcAddressSelector'
import { emptyPsgcAddress, isCompletePsgcAddress } from '../../utils/psgcAddress'
import { isStandalonePwa } from '../../utils/pwaUtils'
import './LoginPage.css'

function AccountActivationPage() {
  const [searchParams] = useSearchParams()
  const { token: tokenParam } = useParams()
  const navigate = useNavigate()
  const token = String(tokenParam || searchParams.get('token') || '').trim()
  const email = String(searchParams.get('email') || '').trim().toLowerCase()

  const loginPath = useMemo(
    () => (isStandalonePwa() ? '/customer/login' : '/login'),
    [],
  )

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [companyAddress, setCompanyAddress] = useState(emptyPsgcAddress)
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
      if (!isCompletePsgcAddress(companyAddress)) {
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
          region_code: companyAddress.region_code,
          province_code: companyAddress.province_code || null,
          city_code: companyAddress.city_code,
          barangay_code: companyAddress.barangay_code,
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
            Ask your administrator to open <strong>User Management</strong> and click <strong>Resend invite</strong> for this account, then use the newest email.
          </p>
          <p className="auth-alt-link">
            <Link to={loginPath}>Back to sign in</Link>
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
              <PsgcAddressSelector
                title="Company address"
                value={companyAddress}
                onChange={setCompanyAddress}
              />
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
