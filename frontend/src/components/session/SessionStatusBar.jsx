import { useEffect, useState } from 'react'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import useAuth from '../../hooks/useAuth'

/**
 * FR UI — connection + session status indicators.
 * Online / Offline / Session Expired banners for customer + staff surfaces.
 */
function SessionStatusBar({ className = '' }) {
  const isOnline = useOnlineStatus()
  const { sessionExpired, isAuthenticated } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(sessionExpired || !isOnline)
  }, [sessionExpired, isOnline])

  if (!visible && isOnline && !sessionExpired) return null

  let state = 'online'
  let label = '🟢 Connected'
  let cls = 'session-status-bar session-status-bar--online'

  if (sessionExpired) {
    state = 'expired'
    label = '🔴 Session expired. Please login again.'
    cls = 'session-status-bar session-status-bar--expired'
  } else if (!isOnline) {
    state = 'offline'
    label = isAuthenticated
      ? '🟡 Offline Mode — changes will sync when connected'
      : '🟡 Offline Mode'
    cls = 'session-status-bar session-status-bar--offline'
  }

  return (
    <div className={`${cls} ${className}`.trim()} role="status" aria-live="polite" data-state={state}>
      <span>{label}</span>
    </div>
  )
}

export default SessionStatusBar
