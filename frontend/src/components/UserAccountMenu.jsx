import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import useLogoutConfirmation from '../hooks/useLogoutConfirmation'

function UserAccountMenu({ profilePath, className = '' }) {
  const { user } = useAuth()
  const { openLogoutConfirm, logoutConfirmModal } = useLogoutConfirmation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DX'

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleLogoutClick = (event) => {
    setOpen(false)
    openLogoutConfirm(event)
  }

  const close = () => setOpen(false)

  return (
    <div className={`dx-account-menu${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`topbar-avatar dx-account-menu__trigger${open ? ' dx-account-menu__trigger--open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        title={user?.name ?? 'Account'}
      >
        {initials}
      </button>

      {open && (
        <div className="dx-account-menu__panel customer-user-dropdown" role="menu">
          <p className="dx-account-menu__heading">{user?.name ?? 'Account'}</p>
          {user?.email ? (
            <p className="dx-account-menu__email">{user.email}</p>
          ) : null}
          {profilePath ? (
            <NavLink to={profilePath} className="dx-account-menu__item" role="menuitem" onClick={close}>
              <User size={15} aria-hidden />
              Edit Profile
            </NavLink>
          ) : null}
          <div className="dropdown-divider" />
          <button type="button" className="dx-account-menu__item dropdown-logout" role="menuitem" onClick={handleLogoutClick}>
            <LogOut size={15} aria-hidden />
            Log out
          </button>
        </div>
      )}

      {logoutConfirmModal}
    </div>
  )
}

export default UserAccountMenu
