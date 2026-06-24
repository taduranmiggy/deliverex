import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { Lock } from 'lucide-react'
import '../../styles/driver-app.css'

function DriverChangePasswordPage() {
  const { updateUser } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const result = await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      updateUser(result.user)
      navigate('/driver', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="driver-native-login">
      <div className="driver-native-login__hero">
        <div className="driver-native-login__logo">
          <Lock size={28} aria-hidden />
        </div>
        <h1>Create new password</h1>
        <p>Your account uses a temporary password. Set a new password to continue.</p>
      </div>
      <div className="driver-native-login__card">
        <form onSubmit={handleSubmit} className="driver-login-form">
          <label>
            Current (temporary) password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="driver-login-error">{error}</p> : null}
          <button type="submit" className="driver-btn-login" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default DriverChangePasswordPage
