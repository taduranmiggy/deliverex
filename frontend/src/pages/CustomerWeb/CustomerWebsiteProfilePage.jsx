import { useState } from 'react'
import { changePassword } from '../../api/auth'
import useAuth from '../../hooks/useAuth'

function CustomerWebsiteProfilePage() {
  const { user, updateUser } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
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

  return (
    <div className="customer-web-page">
      <div className="customer-web-page-head">
        <h2>Profile</h2>
        <p>Manage account details and password from the desktop website interface.</p>
      </div>

      <div className="customer-web-profile-grid">
        <article className="customer-web-card">
          <h3>Account details</h3>
          <dl>
            <dt>Name</dt>
            <dd>{user?.name ?? '—'}</dd>
            <dt>Email</dt>
            <dd>{user?.email ?? '—'}</dd>
            <dt>Company</dt>
            <dd>{user?.company_name ?? '—'}</dd>
          </dl>
        </article>

        <form className="customer-web-card customer-web-form" onSubmit={handleSubmit}>
          <h3>Change password</h3>
          <label>
            Current password
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label>
            New password
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Confirm new password
            <input type="password" required minLength={8} value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} />
          </label>
          {error ? <p className="notice error">{error}</p> : null}
          {message ? <p className="notice">{message}</p> : null}
          <button type="submit" className="btn-dx-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CustomerWebsiteProfilePage
