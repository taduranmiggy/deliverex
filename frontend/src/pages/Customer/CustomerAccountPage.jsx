import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { changePassword } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import { Link2, Lock, LogOut, Package, Settings, User } from 'lucide-react'

function CustomerAccountPage() {
  const { user, isAuthenticated, role, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const isCustomer = isAuthenticated && role === 'customer'

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      updateUser(res.user)
      setMessage('Password updated successfully.')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/customer', { replace: true })
  }

  if (!isCustomer) {
    return (
      <div className="customer-page pwa-page">
        <header className="pwa-page-header">
          <p className="pwa-page-eyebrow">Account</p>
          <h1>Your Account</h1>
          <p>Sign in to manage deliveries linked to your email.</p>
        </header>
        <div className="customer-content">
          <div className="pwa-account-guest">
            <div className="pwa-account-guest__icon" aria-hidden>
              <User size={36} />
            </div>
            <p className="pwa-empty-state__title">Guest mode</p>
            <p className="pwa-empty-state__message">
              Tracking, support, and FAQs are available without an account. Sign in when you need delivery history and linked shipments.
            </p>
            <div className="pwa-empty-state__actions">
              <Link to="/customer/login" className="btn-dx-primary btn-lg">Sign In</Link>
              <Link to="/customer/signup" className="btn-dx-secondary btn-lg">Create Account</Link>
            </div>
            <p className="pwa-section__hint" style={{ marginTop: 24 }}>
              Drivers and staff should use the web browser at <strong>/driver</strong> or <strong>/login</strong>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="customer-page pwa-page">
      <header className="pwa-page-header pwa-page-header--compact">
        <p className="pwa-page-eyebrow">Account</p>
        <h1>{user?.name}</h1>
        <p>{user?.email}</p>
      </header>

      <div className="customer-content" style={{ paddingBottom: 24 }}>
        <div className="pwa-account-links">
          <Link to="/customer/deliveries" className="pwa-account-link">
            <Package size={18} /> My Deliveries
          </Link>
          <Link to="/customer/link-delivery" className="pwa-account-link">
            <Link2 size={18} /> Link Delivery
          </Link>
          <Link to="/customer/account" className="pwa-account-link pwa-account-link--active">
            <Settings size={18} /> Account Settings
          </Link>
        </div>

        <section className="pwa-section">
          <h2 className="pwa-section__title">Change password</h2>
          <form className="pwa-form-card" onSubmit={handleSubmit}>
            <label>
              Current password
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </label>
            <label>
              New password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </label>
            <label>
              Confirm new password
              <input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required minLength={8} autoComplete="new-password" />
            </label>
            {error ? <p className="notice error">{error}</p> : null}
            {message ? <p className="notice">{message}</p> : null}
            <button type="submit" className="btn-dx-primary" disabled={submitting}>
              <Lock size={16} /> {submitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </section>

        <button type="button" className="pwa-account-logout" onClick={handleLogout}>
          <LogOut size={18} /> Sign out
        </button>
      </div>

      <LoadingOverlay open={submitting} message="Updating password" submessage="Please wait." />
    </div>
  )
}

export default CustomerAccountPage
