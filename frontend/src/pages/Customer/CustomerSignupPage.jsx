import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerCustomer } from '../../api/auth'
import useAuth from '../../hooks/useAuth'
import '../Auth/LoginPage.css'

export default function CustomerSignupPage() {
  const [error, setError] = useState('')
  const [pwError, setPwError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setPwError('')
    const formData = new FormData(event.target)
    const password = String(formData.get('password') ?? '')
    const confirmation = String(formData.get('password_confirmation') ?? '')
    if (password !== confirmation) {
      setPwError('Passwords must match.')
      return
    }

    try {
      const result = await registerCustomer({
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone') || undefined,
        password,
        password_confirmation: confirmation,
      })
      login(result.user, result.token)
      navigate('/customer/deliveries', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx auth-card--signup">
        <Link to="/customer" className="auth-back-home">
          ← Back to customer home
        </Link>
        <h1>Create customer account</h1>
        <p className="auth-welcome auth-welcome--sub">
          Register to see deliveries linked to your account. Tracking by code stays available without an account.
        </p>

        <form onSubmit={handleSubmit} className="auth-form-dx">
          <label>
            Full name
            <input name="name" type="text" autoComplete="name" required placeholder="Maria Santos" />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <label>
            Mobile (optional)
            <input name="phone" type="tel" autoComplete="tel" placeholder="+63 9XX XXX XXXX" />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm password
            <input
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {pwError ? <p className="auth-error-dx">{pwError}</p> : null}
          {error ? <p className="auth-error-dx">{error}</p> : null}
          <button className="btn-dx-login" type="submit">
            Create account
          </button>
        </form>
        <p className="auth-alt-link">
          Already registered?{' '}
          <Link className="auth-inline-link" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  )
}
