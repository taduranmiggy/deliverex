import { useEffect, useState } from 'react'
import { changePassword, updateProfile } from '../../api/auth'
import { PhonePhInput } from '../../components/PhonePhInput'
import { PageHeader } from '../../components/ui'
import useAuth from '../../hooks/useAuth'
import { useToast } from '../../context/ToastContext'
import { Loader2, Lock, Save } from 'lucide-react'

function EditProfilePage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
    setPhone(user?.phone ?? '')
  }, [user?.id, user?.name, user?.phone])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileError('')
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
      toast('Profile updated.', 'success')
    } catch (err) {
      setProfileError(err.message || 'Could not update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (password !== passwordConfirmation) {
      setPasswordError('Passwords do not match.')
      return
    }

    setSavingPassword(true)
    try {
      const res = await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      updateUser(res.user)
      toast('Password updated.', 'success')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
    } catch (err) {
      setPasswordError(err.message || 'Could not update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Edit Profile"
        subtitle="Update your account details and password."
      />

      <div className="dx-profile-edit-grid">
        <section className="dx-panel">
          <h3 className="dx-panel-title">Profile details</h3>
          <form className="form-grid" onSubmit={handleProfileSubmit}>
            <label>
              <span className="dx-field-label">Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label>
              <span className="dx-field-label">Email</span>
              <input type="email" value={user?.email ?? ''} readOnly disabled />
            </label>
            <label>
              <span className="dx-field-label">Phone</span>
              <PhonePhInput value={phone} onChange={setPhone} />
            </label>
            {user?.role?.name ? (
              <label>
                <span className="dx-field-label">Role</span>
                <input
                  type="text"
                  value={user.role.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  readOnly
                  disabled
                />
              </label>
            ) : null}
            {profileError ? <p className="notice error">{profileError}</p> : null}
            <div>
              <button type="submit" className="btn-dx-primary" disabled={savingProfile}>
                {savingProfile
                  ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                  : <><Save size={15} /> Save profile</>}
              </button>
            </div>
          </form>
        </section>

        <section className="dx-panel">
          <h3 className="dx-panel-title">Change password</h3>
          <form className="form-grid" onSubmit={handlePasswordSubmit}>
            <label>
              <span className="dx-field-label">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              <span className="dx-field-label">New password</span>
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
              <span className="dx-field-label">Confirm new password</span>
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            {passwordError ? <p className="notice error">{passwordError}</p> : null}
            <div>
              <button type="submit" className="btn-dx-secondary" disabled={savingPassword}>
                {savingPassword
                  ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Updating…</>
                  : <><Lock size={15} /> Update password</>}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}

export default EditProfilePage
