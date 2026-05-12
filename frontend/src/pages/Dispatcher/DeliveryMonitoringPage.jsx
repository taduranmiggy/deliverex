import { useEffect, useMemo, useState } from 'react'
import { fetchAssignments } from '../../api/dispatcher'
import { IconMapPinFilled } from '../../components/DxIcons'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus } from '../../utils/statusLabels'

const PLACES = ['Valenzuela', 'Taguig', 'Pasig', 'Makati', 'Marikina']

function DeliveryMonitoringPage() {
  const [assignments, setAssignments] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const response = await fetchAssignments(1)
        setAssignments(response.data || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadAssignments()
    const interval = setInterval(loadAssignments, 15000)
    return () => clearInterval(interval)
  }, [])

  const coords = useMemo(
    () => assignments.map((_, i) => ({ left: 18 + i * 16 + (i % 2) * 8, top: 30 + ((i * 23) % 55) })),
    [assignments],
  )

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Live Tracking</h1>
          <p>Real-time driver and delivery tracking</p>
        </div>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit">
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <h3 className="dx-panel-title">Live Map</h3>
          <div className="dx-live-map-shell" style={{ minHeight: 420 }}>
            {assignments.slice(0, 6).map((_, i) => (
              <span
                key={i}
                className="dx-map-pin"
                style={{ left: `${coords[i]?.left}%`, top: `${coords[i]?.top}%` }}
                aria-hidden
              >
                <IconMapPinFilled />
              </span>
            ))}
            <div className="dx-live-map-msg">
              <strong>{assignments.length} drivers active</strong>
              <span>Hover over pins for details</span>
            </div>
          </div>
        </div>

        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="dx-panel-title" style={{ marginBottom: 14 }}>
              Active Drivers
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              {assignments.length} on the road
            </span>
          </div>
          <div className="dx-driver-cards">
            {assignments.map((assignment, idx) => (
              <div key={assignment.id} className="dx-driver-card-dx">
                <header>
                  <strong>{assignment.driver?.user?.name ?? 'Driver'}</strong>
                  <span className="dx-driver-dot">Active</span>
                </header>
                <div className="dx-driver-muted">
                  <div>{assignment.driver?.user?.phone ?? '—'} </div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="dx-icon-muted" aria-hidden="true">
                      <IconMapPinFilled />
                    </span>
                    <span>{PLACES[idx % PLACES.length]}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>Last ping: {idx + 1} mins ago</div>
                  <div style={{ marginTop: 4 }}>
                    Current job:{' '}
                    <strong>{formatJobPublicId(assignment.job_order_id)}</strong>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Status: <strong>{formatJobStatus(assignment.status)}</strong>
                    <span style={{ color: 'var(--muted)' }}> · ETA ~2:00 PM</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default DeliveryMonitoringPage
