import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { changePassword, updateProfile } from '../../api/auth'
import { PhonePhInput } from '../../components/PhonePhInput'
import useAuth from '../../hooks/useAuth'
import LoadingOverlay from '../../components/customer/LoadingOverlay'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { useToast } from '../../context/ToastContext'
import { Link2, Lock, LogOut, Package, Save, Settings, User, Users } from 'lucide-react'

function CustomerAccountPage() {
  const { user, isAuthenticated, role, logout, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { paths } = useCustomerSurface()
  const isCustomer = isAuthenticated && role === 'customer'
  const signInPath = paths.signIn

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
    setPhone(user?.phone ?? '')
  }, [user?.id, user?.name, user?.phone])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileMessage('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setProfileError('Name is required.')
      return
    }
    setSavingProfile(true)
    try {
      const res = await updateProfile({
        name: trimmedName,
        phone: phone.trim() || null,
      })
      updateUser(res.user)
      setProfileMessage('Profile updated successfully.')
      toast('Profile updated.', 'success')
    } catch (err) {
      setProfileError(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

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
    navigate(paths.signIn, { replace: true })
  }

  if (!isCustomer) {
    return (
      <CustomerPageShell className="pwa-page">
        <CustomerPageHeader
          eyebrow="Account"
          title="Your Account"
          description="Sign in to manage deliveries linked to your email."
        />
        <div className="pwa-account-guest">
          <div className="pwa-account-guest__icon" aria-hidden>
            <User size={36} />
          </div>
          <p className="pwa-empty-state__title">Guest mode</p>
          <p className="pwa-empty-state__message">
            Tracking, support, and FAQs are available without an account. Sign in when you need delivery history and linked shipments.
          </p>
          <div className="pwa-empty-state__actions">
            <Link to={signInPath} className="btn-dx-primary btn-lg">Sign In</Link>
          </div>
          <p className="pwa-section__hint" style={{ marginTop: 24 }}>
            Drivers and staff should use the web browser at <strong>/driver</strong> or <strong>/login</strong>.
          </p>
        </div>
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell className="pwa-page">
      <CustomerPageHeader
        eyebrow="Account"
        title={user?.name}
        description={user?.company_name ? `${user.company_name} · ${user?.email}` : user?.email}
      />

      <div className="pwa-account-links">
        <Link to={paths.deliveries} className="pwa-account-link">
          <Package size={18} /> My Deliveries
        </Link>
        {user?.company_role === 'owner' && (
          <Link to={paths.team} className="pwa-account-link">
            <Users size={18} /> Team
          </Link>
        )}
        <Link to={paths.linkDelivery} className="pwa-account-link">
          <Link2 size={18} /> Link Delivery
        </Link>
        <Link to={paths.profile} className="pwa-account-link pwa-account-link--active">
          <Settings size={18} /> Account Settings
        </Link>
      </div>

      <section className="pwa-section">
        <h2 className="pwa-section__title">Profile details</h2>
        <form className="pwa-form-card" onSubmit={handleProfileSubmit}>
          <label>
            Full name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label>
            Email
            <input type="email" value={user?.email ?? ''} readOnly disabled />
          </label>
          <label>
            Phone
            <PhonePhInput value={phone} onChange={setPhone} />
          </label>
          {profileError ? <p className="notice error">{profileError}</p> : null}
          {profileMessage ? <p className="notice">{profileMessage}</p> : null}
          <button type="submit" className="btn-dx-primary" disabled={savingProfile}>
            <Save size={16} /> {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

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

      <LoadingOverlay open={submitting || savingProfile} message="Saving changes" submessage="Please wait." />
    </CustomerPageShell>
  )
}

export default CustomerAccountPage
