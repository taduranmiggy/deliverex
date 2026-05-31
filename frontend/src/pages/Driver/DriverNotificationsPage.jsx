import { useEffect, useMemo, useState } from 'react'
import DriverOfflineBar from '../../components/driver/DriverOfflineBar'
import { fetchNotifications, markNotificationRead } from '../../api/notifications'
import { Bell, CheckCheck } from 'lucide-react'

function DriverNotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchNotifications(1)
      setNotifications(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  )

  const handleRead = async (id) => {
    try {
      await markNotificationRead(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const markAllRead = async () => {
    try {
      await Promise.all(
        notifications.filter((n) => !n.is_read).map((n) => markNotificationRead(n.id)),
      )
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <DriverOfflineBar />

      {unreadCount > 0 && (
        <button type="button" className="da-btn da-btn--outline da-btn--block" style={{ marginBottom: 16 }} onClick={markAllRead}>
          <CheckCheck size={16} /> Mark all as read
        </button>
      )}

      {error && <p className="da-alert da-alert--error">{error}</p>}

      {loading && (
        <>
          <div className="da-skeleton" />
          <div className="da-skeleton" />
        </>
      )}

      {!loading && notifications.length === 0 && (
        <div className="da-empty">
          <Bell size={32} />
          <p style={{ fontWeight: 700, margin: '8px 0 0' }}>No notifications yet</p>
          <p style={{ fontSize: '0.875rem', margin: '4px 0 0' }}>
            Assignment updates and document results will appear here.
          </p>
        </div>
      )}

      {!loading && notifications.map((note) => (
        <article
          key={note.id}
          className={`da-notif${note.is_read ? ' da-notif--read' : ' da-notif--unread'}`}
        >
          <span className="da-notif__dot" aria-hidden />
          <div className="da-notif__body">
            <h3>{note.title}</h3>
            <p>{note.message}</p>
            <time className="da-notif__time">
              {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
            </time>
          </div>
          {!note.is_read && (
            <button
              type="button"
              className="da-btn da-btn--primary"
              style={{ minHeight: 44, padding: '8px 12px', fontSize: '0.75rem', flexShrink: 0 }}
              onClick={() => handleRead(note.id)}
            >
              Read
            </button>
          )}
        </article>
      ))}
    </>
  )
}

export default DriverNotificationsPage
