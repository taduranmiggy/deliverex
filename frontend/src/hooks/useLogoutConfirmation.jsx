import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import useAuth from './useAuth'
import { useToast } from '../context/ToastContext'

const LOGOUT_HINTS = {
  dispatcher: 'You will need to sign in again to access dispatch tools, job orders, and live tracking.',
  admin: 'You will need to sign in again to access admin tools and fleet management.',
  manager: 'You will need to sign in again to access fleet analytics and monitoring.',
  driver: 'Your delivery assignments stay saved — sign back in to continue updating status and GPS.',
  customer: 'Your delivery history stays saved — sign back in anytime to track shipments.',
}

/**
 * Logout confirmation flow shared across web staff, driver, and customer/PWA surfaces.
 *
 * @param {{ redirectTo?: string }} [options]
 * @returns {{ openLogoutConfirm: (event?: { currentTarget?: HTMLElement }) => void, logoutConfirmModal: import('react').ReactNode }}
 */
export function useLogoutConfirmation(options = {}) {
  const { logout, role, user } = useAuth()
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

  const accountDetail = useMemo(() => {
    const name = user?.name?.trim()
    const email = user?.email?.trim()
    if (name && email && name.toLowerCase() !== email.toLowerCase()) {
      return `Signed in as ${name} · ${email}`
    }
    if (name) return `Signed in as ${name}`
    if (email) return `Signed in as ${email}`
    return null
  }, [user?.name, user?.email])

  const logoutHint = LOGOUT_HINTS[role] ?? 'You will need to sign in again to continue using Deliverex.'

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
      title="Sign out of Deliverex?"
      message="Are you sure you want to sign out of your Deliverex account?"
      detail={accountDetail}
      hint={logoutHint}
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
