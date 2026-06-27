import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import '../Auth/LoginPage.css'

function CustomerForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await forgotPassword({ email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx">
        <Link to="/customer/login" className="auth-back-home">
          ← Back to customer login
        </Link>
        <h1>Forgot password?</h1>
        <p className="auth-welcome auth-welcome--sub">
          Enter the email on your customer account. If it exists, we will send a password reset link.
        </p>

        {sent ? (
          <div>
            <p className="auth-success-dx">
              If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.
            </p>
            <p className="auth-alt-link" style={{ marginTop: 16 }}>
              <Link to="/customer/login">Return to customer login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form-dx">
            <label>
              Email
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
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
      <LoadingOverlay open={submitting} message="Sending reset link" submessage="Please wait." />
    </section>
  )
}

export default CustomerForgotPasswordPage
