import { useEffect, useState } from 'react'
import { fetchDrivers, fetchOcrQueue, fetchUsers, fetchVehicles } from '../../api/admin'
import { IconAlertCircleOutline, IconClock, IconDocOutline } from '../../components/DxIcons'

function AdminDashboard() {
  const [summary, setSummary] = useState({ users: 0, drivers: 0, vehicles: 0, ocr: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [users, drivers, vehicles, ocr] = await Promise.all([
          fetchUsers(1),
          fetchDrivers(1),
          fetchVehicles(1),
          fetchOcrQueue(1),
        ])
        setSummary({
          users: users.total ?? users.data?.length ?? 0,
          drivers: drivers.total ?? drivers.data?.length ?? 0,
          vehicles: vehicles.total ?? vehicles.data?.length ?? 0,
          ocr: ocr.total ?? ocr.data?.length ?? 0,
        })
      } catch (err) {
        setError(err.message)
      }
    }

    loadSummary()
  }, [])

  const bars = [
    { h: '28%', label: 'Mon' },
    { h: '40%', label: 'Tue' },
    { h: '35%', label: 'Wed' },
    { h: '68%', label: 'Thu' },
    { h: '45%', label: 'Fri' },
  ]

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Admin Dashboard</h1>
          <p>OCR validation and system overview</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-stat-row">
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconDocOutline />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Docs Awaiting Validation</div>
            <div className="dx-stat-card__value">{summary.ocr}</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconClock />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Avg Validation Time</div>
            <div className="dx-stat-card__value">2.5 min</div>
          </div>
        </div>
        <div className="dx-stat-card">
          <div className="dx-stat-card__icon" aria-hidden="true">
            <IconAlertCircleOutline />
          </div>
          <div className="dx-stat-card__meta">
            <div className="dx-stat-card__label">Rejected Today</div>
            <div className="dx-stat-card__value">3</div>
          </div>
        </div>
      </div>

      <div className="dx-panel">
        <h2 className="dx-panel-title">Documents per Day</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div className="dx-bar-chart">
              {bars.map((b) => (
                <div
                  key={b.label}
                  className="dx-bar"
                  style={{ height: b.h }}
                  title={`${b.label}`}
                  role="presentation"
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '8px 20px 0' }}>
              {bars.map((b) => (
                <span key={`l-${b.label}`} className="dx-bar-label">
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dx-panel">
        <h2 className="dx-panel-title">Recent Activity</h2>
        <div className="dx-panel" style={{ padding: 0, boxShadow: 'none', border: 'none' }}>
          <div className="dx-activity-item">
            <span>OCR document validated</span>
            <span className="dx-activity-time">Maria Santos · 5 mins ago</span>
          </div>
          <div className="dx-activity-item">
            <span>New user created</span>
            <span className="dx-activity-time">Maria Santos · 1 hour ago</span>
          </div>
          <div className="dx-activity-item">
            <span>Vehicle maintenance updated</span>
            <span className="dx-activity-time">Maria Santos · 2 hours ago</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AdminDashboard
