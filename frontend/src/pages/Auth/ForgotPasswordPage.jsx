import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import DeliverexSiteFooter from '../../components/customer/DeliverexSiteFooter'
import './LoginPage.css'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Email address is required.')
      return
    }
    setSubmitting(true)
    try {
      await forgotPassword({ email: trimmed })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-split-root">
      <section className="auth-page auth-page--dx auth-page--forgot">
        <div className="auth-card auth-card--dx">
          <Link to="/login" className="auth-back-home">
            ← Back to sign in
          </Link>
          <h1>Forgot password?</h1>
          <p className="auth-welcome auth-welcome--sub">
            Enter the email address on your Deliverex account. If an account with this email exists,
            a password reset link will be sent.
          </p>

          {sent ? (
            <div>
              <p className="auth-success-dx">
                If an account with this email exists, a password reset link has been sent.
                Check your inbox and spam folder.
              </p>
              <p className="auth-alt-link" style={{ marginTop: 16 }}>
                <Link to="/login">Back to sign in</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form-dx" noValidate>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {error ? <p className="auth-error-dx">{error}</p> : null}
              <button className="btn-dx-login" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </section>
      <DeliverexSiteFooter />
      <LoadingOverlay open={submitting} message="Sending reset link" submessage="Please wait." />
    </div>
  )
}

export default ForgotPasswordPage
