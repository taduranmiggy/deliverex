import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { IconLogout } from './DxIcons'

function LogoutButton() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <button type="button" className="btn-dx-logout" onClick={handleLogout}>
      <IconLogout />
      Log Out
    </button>
  )
}

export default LogoutButton
