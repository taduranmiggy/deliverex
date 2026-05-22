import { Link } from 'react-router-dom'
import { IconChevronLeft } from '../../components/DxIcons'
import './LoginPage.css'

function DriverSignupPage() {
  return (
    <section className="auth-page auth-page--dx">
      <div className="auth-card auth-card--dx" style={{ textAlign: 'center' }}>
        <Link to="/driver/login" className="auth-back-home">
          <IconChevronLeft />
          Back to login
        </Link>
        <h1 style={{ marginTop: 16 }}>Driver Account Access</h1>
        <p className="auth-welcome auth-welcome--sub" style={{ marginBottom: 24 }}>
          Driver accounts are created and managed by the system administrator.
          Please contact your dispatcher or admin to receive your login credentials.
        </p>
        <Link to="/driver/login" className="btn-dx-login" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Go to Driver Login
        </Link>
      </div>
    </section>
  )
}

export default DriverSignupPage
