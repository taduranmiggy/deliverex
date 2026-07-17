import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'
import AuthMarketingAside from '../../components/auth/AuthMarketingAside'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import DeliverexSiteFooter from '../../components/customer/DeliverexSiteFooter'
import { IconChevronLeft, IconMail } from '../../components/DxIcons'
import { MotionButton, MotionPage, MotionStagger, MotionStaggerItem } from '../../motion'
import './LoginPage.css'

const FORGOT_SLIDES = [
  {
    title: 'Secure account recovery.',
    subtitle: 'Enter the email on your Deliverex account and we\'ll send a password reset link if it matches.',
  },
  {
    title: 'Check your inbox.',
    subtitle: 'Reset links expire for your security. If you don\'t see the email, check spam or request a new link.',
  },
]

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const emailId = useId()

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
    <MotionPage className="auth-split-root">
      <section className="auth-split-layout" aria-label="Forgot password">
        <div className="auth-split-form-col">
          <MotionStagger className="auth-split-form-inner">
            <MotionStaggerItem index={0}>
            <Link to="/login" className="auth-back-home auth-back-home--split">
              <IconChevronLeft />
              Back to sign in
            </Link>
            </MotionStaggerItem>

            <MotionStaggerItem index={1}>
            <div className="auth-brand-lockup">
              <span className="auth-brand-logo" aria-hidden />
              <span className="auth-brand-text">Deliverex</span>
            </div>

            <h1 className="auth-split-title">Forgot password?</h1>
            <p className="auth-split-lead">
              Enter the email address on your Deliverex account. If an account with this email exists,
              a password reset link will be sent.
            </p>
            </MotionStaggerItem>

            <MotionStaggerItem index={2}>
            {sent ? (
              <div className="auth-forgot-success">
                <p className="auth-success-dx auth-success-split">
                  If an account with this email exists, a password reset link has been sent.
                  Check your inbox and spam folder.
                </p>
                <Link to="/login" className="auth-btn-submit auth-btn-submit--link">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form-split" noValidate>
                <div className="auth-field-split">
                  <label htmlFor={emailId}>Email address</label>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon">
                      <IconMail />
                    </span>
                    <input
                      id={emailId}
                      name="email"
                      type="email"
                      className="auth-input-control motion-focus-glow"
                      autoComplete="email"
                      required
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {error ? <p className="auth-error-dx auth-error-split">{error}</p> : null}

                <MotionButton className="auth-btn-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send reset link'}
                </MotionButton>
              </form>
            )}
            </MotionStaggerItem>
          </MotionStagger>
        </div>

        <AuthMarketingAside slides={FORGOT_SLIDES} />
      </section>
      <DeliverexSiteFooter />
      <LoadingOverlay open={submitting} message="Sending reset link" submessage="Please wait." />
    </MotionPage>
  )
}

export default ForgotPasswordPage
