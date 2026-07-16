import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import useAuth from './useAuth'
import { useToast } from '../context/ToastContext'

/**
 * Logout confirmation flow shared across web staff, driver, and customer/PWA surfaces.
 *
 * @param {{ redirectTo?: string }} [options]
 * @returns {{ openLogoutConfirm: (event?: { currentTarget?: HTMLElement }) => void, logoutConfirmModal: import('react').ReactNode }}
 */
export function useLogoutConfirmation(options = {}) {
  const { logout, role } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef(null)

  const resolveRedirect = useCallback(() => {
    if (options.redirectTo) return options.redirectTo
    if (role === 'driver') return '/driver/login'
    if (role === 'customer') return '/customer/sign-in'
    return '/login'
  }, [options.redirectTo, role])

  const openLogoutConfirm = useCallback((event) => {
    if (event?.currentTarget instanceof HTMLElement) {
      triggerRef.current = event.currentTarget
    }
    setOpen(true)
  }, [])

  const handleCancel = useCallback(() => {
    if (loading) return
    setOpen(false)
  }, [loading])

  const handleConfirm = useCallback(async () => {
    if (loading) return

    setLoading(true)
    try {
      await logout()
      setOpen(false)
      navigate(resolveRedirect(), { replace: true })
    } catch {
      toast('Unable to sign out. Please try again.', 'error')
      setLoading(false)
    }
  }, [loading, logout, navigate, resolveRedirect, toast])

  const logoutConfirmModal = (
    <ConfirmationModal
      open={open}
      title="Sign Out?"
      message="Are you sure you want to sign out of your Deliverex account?"
      variant="logout"
      confirmLabel="Sign Out"
      cancelLabel="Cancel"
      loading={loading}
      loadingLabel="Signing out"
      returnFocusRef={triggerRef}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { openLogoutConfirm, logoutConfirmModal }
}

export default useLogoutConfirmation
