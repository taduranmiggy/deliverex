import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchPasswordResetContext, resetPassword } from '../../api/auth'
import PasswordFieldsForm, { allPasswordRulesPassed } from '../../components/auth/PasswordFieldsForm'
import { isStandalonePwa } from '../../utils/pwaUtils'
import './LoginPage.css'

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
  const [context, setContext] = useState(null)
  const [loadingContext, setLoadingContext] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

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
      setError('Invalid or expired reset link.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
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
          <h1>Password updated successfully</h1>
          <p className="auth-success-dx">
            Your password has been updated. You can now sign in with your new password.
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

  if (!token || !email) {
    return (
      <div className="auth-page auth-page--dx">
        <div className="auth-card auth-card--dx">
          <h1>Reset link invalid</h1>
          <p className="auth-error-dx">This password reset link is missing required information or has expired.</p>
          <p className="auth-alt-link">
            <Link to={forgotPath}>Request a new reset link</Link>
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
        <h1>Reset your password</h1>
        <p className="auth-welcome auth-welcome--sub">
          Create a new password for your Deliverex account.
        </p>
        <form onSubmit={handleSubmit} className="auth-form-dx auth-activation-form" noValidate>
          <PasswordFieldsForm
            idPrefix="reset-password"
            password={password}
            passwordConfirmation={passwordConfirmation}
            onPasswordChange={setPassword}
            onPasswordConfirmationChange={setPasswordConfirmation}
          />

          {error ? <p className="auth-error-dx">{error}</p> : null}
          <button className="btn-dx-login" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Reset Password'}
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
