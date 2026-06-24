import { useState } from 'react'
import { changePassword } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import { PageHeader, SectionCard } from '../../components/ui'
import { Lock, User } from 'lucide-react'

function CustomerAccountPage() {
  const { user, updateUser } = useAuth()
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

  return (
    <div className="customer-page" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>
      <PageHeader title="Account settings" subtitle="Manage your profile and password." />

      <SectionCard title="Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <User size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{user?.name}</p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted)' }}>{user?.email}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Change password" style={{ marginTop: 20 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" style={{ width: '100%', marginTop: 6 }} />
          </label>
          <label>
            New password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{ width: '100%', marginTop: 6 }} />
          </label>
          <label>
            Confirm new password
            <input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required minLength={8} autoComplete="new-password" style={{ width: '100%', marginTop: 6 }} />
          </label>
          {error && <p className="notice error" style={{ margin: 0 }}>{error}</p>}
          {message && <p className="notice" style={{ margin: 0 }}>{message}</p>}
          <button type="submit" className="btn-dx-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
            <Lock size={16} /> {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </SectionCard>
    </div>
  )
}

export default CustomerAccountPage
