import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { IconLogout } from './DxIcons'

function LogoutButton({ compact = false }) {
  const { logout, role } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    const loginPath = role === 'driver' ? '/driver/login' : '/login'
    await logout()
    navigate(loginPath, { replace: true })
  }

  if (compact) {
    return (
      <button
        type="button"
        className="driver-nav-logout-btn"
        onClick={handleLogout}
        aria-label="Log out"
        title="Log out"
      >
        <IconLogout />
      </button>
    )
  }

  return (
    <button type="button" className="btn-dx-logout" onClick={handleLogout}>
      <IconLogout />
      Log Out
    </button>
  )
}

export default LogoutButton
