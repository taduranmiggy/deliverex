import { useEffect, useMemo, useState } from 'react'
import { fetchNotifications, markNotificationRead } from '../../api/notifications'
import { IconNotifTone } from '../../components/DxIcons'

const DEMO_ADMIN_NOTIFS = [
  {
    id: 9001,
    category: 'Dispatch',
    title: 'Delayed Delivery',
    message: 'Job J-2026-031 is running 15 minutes behind schedule.',
    is_read_default: false,
    tone: 'warning',
    meta: 'Recently · Dispatch',
  },
  {
    id: 9002,
    category: 'Tracking',
    title: 'Delivery Completed',
    message: 'Job J-2026-033 completed successfully by Carlo Mendoza.',
    is_read_default: true,
    tone: 'success',
    meta: '1 hour ago · Tracking',
  },
  {
    id: 9003,
    category: 'Dispatch',
    title: 'New Job Assigned',
    message: 'Job J-2026-034 has been assigned to Juan Dela Cruz.',
    is_read_default: true,
    tone: 'info',
    meta: '3 hours ago · Dispatch',
  },
  {
    id: 9004,
    category: 'Fleet',
    title: 'Vehicle Maintenance Required',
    message: 'Vehicle GHI-5150 requires immediate maintenance check.',
    is_read_default: false,
    tone: 'critical',
    meta: 'Today · Fleet',
  },
]

function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('All Types')
  const [demoReads, setDemoReads] = useState(() => new Set())

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchNotifications(1)
        setNotifications(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [])

  const isDemoId = (id) => typeof id === 'number' && id >= 9000

  const unifiedList = useMemo(() => {
    if (notifications.length) {
      return notifications.map((note, idx) => {
        const mod = idx % 4
        const tone =
          mod === 0 ? 'warning' : mod === 1 ? 'success' : mod === 2 ? 'info' : 'critical'
        return {
          id: note.id,
          title: note.title,
          message: note.message,
          is_read: Boolean(note.is_read),
          tone,
          meta: `${['Dispatch', 'Tracking', 'Fleet'][idx % 3]} · Recently`,
          filterTag: ['Dispatch', 'Tracking', 'Fleet'][idx % 3],
        }
      })
    }
    return DEMO_ADMIN_NOTIFS.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      is_read: row.is_read_default || demoReads.has(row.id),
      tone: row.tone,
      meta: row.meta,
      filterTag: row.category,
    }))
  }, [notifications, demoReads])

  const unreadCount = useMemo(() => unifiedList.filter((n) => !n.is_read).length, [unifiedList])

  const filtered = useMemo(() => {
    if (filterType === 'All Types') return unifiedList
    return unifiedList.filter((n) => n.filterTag === filterType)
  }, [unifiedList, filterType])

  const handleRead = async (id) => {
    if (isDemoId(id)) {
      setDemoReads((prev) => new Set([...prev, id]))
      return
    }
    try {
      await markNotificationRead(id)
      const response = await fetchNotifications(1)
      setNotifications(response.data || [])
    } catch (err) {
      setError(err.message)
    }
  }

  const markAllRead = async () => {
    try {
      if (notifications.length) {
        await Promise.all(
          notifications.filter((n) => !n.is_read).map((n) => markNotificationRead(n.id)),
        )
        const response = await fetchNotifications(1)
        setNotifications(response.data || [])
      } else {
        setDemoReads(new Set(DEMO_ADMIN_NOTIFS.map((d) => d.id)))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const toneLabel = (tone) =>
    ({
      warning: 'Warning',
      success: 'Success',
      info: 'Information',
      critical: 'Critical',
    })[tone] ?? 'Notification'

  return (
    <section>
      <div className="dx-notifs-header">
        <div className="header-stack">
          <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 700 }}>
            Notifications
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.95rem' }}>
            {unreadCount} unread notifications
          </p>
        </div>
        {unreadCount > 0 && (
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
        {filtered.length === 0 ? (
          <p style={{ padding: 24, margin: 0, color: 'var(--muted)' }}>Nothing to show.</p>
        ) : (
          filtered.map((note) => (
            <div key={note.id} className={`dx-notif-item ${!note.is_read ? 'dx-notif-item--unread' : ''}`}>
              <div className={`dx-notif-icon ${note.tone}`} title={toneLabel(note.tone)}>
                <IconNotifTone tone={note.tone} />
              </div>
              <div>
                <p className="dx-notif-title">{note.title}</p>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {note.message}
                </p>
                <p className="dx-notif-meta">{note.meta}</p>
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
                      }}
                      onClick={() => handleRead(note.id)}
                    >
                      Mark read
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default NotificationsPage
