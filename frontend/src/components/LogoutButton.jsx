import useLogoutConfirmation from '../hooks/useLogoutConfirmation'
import { IconLogout } from './DxIcons'

function LogoutButton({ compact = false }) {
  const { openLogoutConfirm, logoutConfirmModal } = useLogoutConfirmation()

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="driver-nav-logout-btn"
          onClick={openLogoutConfirm}
          aria-label="Log out"
          title="Log out"
        >
          <IconLogout />
        </button>
        {logoutConfirmModal}
      </>
    )
  }

  return (
    <>
      <button type="button" className="btn-dx-logout" onClick={openLogoutConfirm}>
        <IconLogout />
        Log Out
      </button>
      {logoutConfirmModal}
    </>
  )
}

export default LogoutButton
