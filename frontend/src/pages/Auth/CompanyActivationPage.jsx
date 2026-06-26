import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { activateCompany, fetchCompanyActivation } from '../../api/auth'
import useAuth from '../../hooks/useAuth'

function CompanyActivationPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchCompanyActivation(token)
        if (!cancelled) setInfo(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

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
      const res = await activateCompany(token, {
        password,
        password_confirmation: passwordConfirmation,
      })
      await login(res.user, res.access_token || res.token, {
        expires_in: res.expires_in,
        session_id: res.session_id,
        refresh_token: res.refresh_token,
      })
      navigate('/customer', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--dx"><p>Validating activation link…</p></div>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--dx">
          <h1>Activation unavailable</h1>
          <p className="notice error">{error}</p>
          <p><Link to="/login">Return to sign in</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--dx auth-card--signup">
        <h1>Activate company account</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
          Set a password for <strong>{info?.company_name}</strong> ({info?.company_email}).
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            Confirm password
            <input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          {error && <p className="notice error">{error}</p>}
          <button type="submit" className="btn-dx-primary btn-block" disabled={submitting}>
            {submitting ? 'Activating…' : 'Activate & sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CompanyActivationPage
