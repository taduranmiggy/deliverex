import { useEffect, useMemo, useState } from 'react'
import { fetchNotifications, markNotificationRead } from '../../api/notifications'
import { IconNotifTone } from '../../components/DxIcons'
function DispatcherNotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('All Types')

  const loadNotifications = async () => {
    try {
      const response = await fetchNotifications(1)
      setNotifications(response.data || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  )

  const handleRead = async (id) => {
    try {
      await markNotificationRead(id)
      loadNotifications()
    } catch (err) {
      setError(err.message)
    }
  }

  const markAllRead = async () => {
    try {
      await Promise.all(
        notifications.filter((n) => !n.is_read).map((n) => markNotificationRead(n.id)),
      )
      await loadNotifications()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <div className="dx-notifs-header">
        <div className="header-stack">
          <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 700 }}>Notifications</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.95rem' }}>
            {unreadCount} unread notifications
          </p>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <button type="button" className="dx-mark-all" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>
      <div style={{ marginBottom: 14 }} className="dx-notifs-filter">
        <select
          aria-label="Filter notifications"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option>All Types</option>
          <option>Dispatch</option>
          <option>Tracking</option>
          <option>Fleet</option>
        </select>
      </div>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel" style={{ padding: 0 }}>
        {notifications.length === 0 && (
          <p style={{ padding: 24, margin: 0, color: 'var(--muted)' }}>No notifications yet.</p>
        )}
        {notifications.map((note, idx) => {
          const tone = idx % 4 === 0 ? 'warning' : idx % 4 === 1 ? 'success' : idx % 4 === 2 ? 'info' : 'critical'
          const tl =
            tone === 'warning'
              ? 'Warning'
              : tone === 'success'
                ? 'Success'
                : tone === 'info'
                  ? 'Information'
                  : 'Critical'
          return (
            <div key={note.id} className="dx-notif-item">
              <div className={`dx-notif-icon ${tone}`} title={tl}>
                <IconNotifTone tone={tone} />
              </div>
              <div>
                <p className="dx-notif-title">{note.title}</p>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {note.message}
                </p>
                <p className="dx-notif-meta">
                  Recently · {[ 'Dispatch', 'Tracking', 'Fleet'][idx % 3]}
                </p>
              </div>
              <div style={{ alignSelf: 'center' }}>
                {!note.is_read ? (
                  <>
                    <span className="dx-notif-dot" title="Unread" />
                    <button
                      type="button"
                      className="btn-dx-secondary"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.6875rem',
                        marginLeft: 8,
                        verticalAlign: 'middle',
                      }}
                      onClick={() => handleRead(note.id)}
                    >
                      Mark read
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default DispatcherNotificationsPage
