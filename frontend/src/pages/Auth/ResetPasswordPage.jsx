import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../../api/auth'
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

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

    setSubmitting(true)
    try {
      await resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
      navigate(loginPath, {
        replace: true,
        state: { notice: 'Password updated. Sign in with your new password.' },
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

  return (
    <div className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx">
        <h1>Create new password</h1>
        <p className="auth-welcome auth-welcome--sub">
          Set a new password for <strong>{email}</strong>.
        </p>
        <form onSubmit={handleSubmit} className="auth-form-dx">
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
            {submitting ? 'Saving…' : 'Update password'}
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
