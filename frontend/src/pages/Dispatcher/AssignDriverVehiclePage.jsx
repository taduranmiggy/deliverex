import { useEffect, useState } from 'react'
import { createAssignment, fetchJobOrders, getBestFit } from '../../api/dispatcher'
import { IconCheckSmall, IconRouteArrow } from '../../components/DxIcons'
import { formatDemoPhp, formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus } from '../../utils/statusLabels'

function AssignDriverVehiclePage() {
  const [jobOrders, setJobOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [recommended, setRecommended] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await fetchJobOrders(1)
        const pending = (response.data || []).filter((item) => item.status === 'pending')
        setJobOrders(pending)
        setSelected((prev) => {
          if (prev && pending.some((p) => p.id === prev.id)) return prev
          return pending[0] ?? null
        })
      } catch (err) {
        setError(err.message)
      }
    }

    loadOrders()
  }, [])

  useEffect(() => {
    const loadBestFit = async () => {
      if (!selected) {
        setRecommendations([])
        return
      }
      try {
        const response = await getBestFit(selected.id)
        setRecommended(response.recommended || null)
        setRecommendations(response.recommendations || [])
      } catch (err) {
        setError(err.message)
      }
    }

    loadBestFit()
  }, [selected])

  const handleAssign = async (driverId, vehicleId, isOverride = false) => {
    if (!selected) {
      setError('Select a job order first.')
      return
    }

    if (isOverride) {
      const ok = window.confirm('This differs from the recommended pairing. Continue with override?')
      if (!ok) {
        return
      }
    }

    try {
      await createAssignment({
        job_order_id: selected.id,
        driver_id: driverId,
        vehicle_id: vehicleId,
      })
      setMessage('Assignment created and driver notified.')
      setError('')
      const response = await fetchJobOrders(1)
      const pending = (response.data || []).filter((item) => item.status === 'pending')
      setJobOrders(pending)
      setSelected(pending[0] ?? null)
    } catch (err) {
      setError(err.message)
    }
  }

  const top = recommended || recommendations[0]

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Dispatch (Best-Fit)</h1>
          <p>Intelligent job assignment recommendations</p>
        </div>
      </header>
      {message && <p className="notice">{message}</p>}
      {error && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit">
        <div>
          <div className="dx-panel" style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--navy)' }}>{jobOrders.length}</strong>{' '}
              jobs pending assignment
            </p>
          </div>
          {jobOrders.length === 0 && (
            <div className="dx-panel">
              <p style={{ margin: 0, color: 'var(--muted)' }}>No unassigned jobs.</p>
            </div>
          )}
          {jobOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              className={`dx-job-card ${selected?.id === order.id ? 'dx-job-card--selected' : ''}`}
              onClick={() => setSelected(order)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="dx-job-card__id">{formatJobPublicId(order.id)}</span>
                <span className="badge-dx badge-dx--pending">{formatJobStatus(order.status)}</span>
              </div>
              <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>{order.customer_name}</p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8125rem' }}>
                {order.vehicle_type_required ?? 'Load'} · {order.vehicle_capacity_required ?? '—'}
              </p>
              <p
                className="dx-route-inline"
                style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}
              >
                <span>{order.pickup_location}</span>
                <span className="dx-route-inline__arrow" aria-hidden="true">
                  <IconRouteArrow />
                </span>
                <span>{order.dropoff_location}</span>
              </p>
              <p style={{ margin: '8px 0 0', fontWeight: 600, color: 'var(--navy)' }}>
                {formatDemoPhp(order.id)}
              </p>
            </button>
          ))}
        </div>

        <div className="dx-panel">
          <h3 className="dx-panel-title">Recommendation Panel</h3>
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>Select a job to view recommendations.</p>
          ) : (
            <>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Material</span>
                <strong>{selected.vehicle_type_required ?? '—'}</strong>
              </div>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Volume / Weight</span>
                <strong>{selected.vehicle_capacity_required ?? '—'}</strong>
              </div>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Time window</span>
                <strong>4:30 PM</strong>
              </div>

              {top && (
                <>
                  <div className="dx-bestfit-banner" role="status">
                    <span className="dx-bestfit-banner__icon" aria-hidden="true">
                      <IconCheckSmall />
                    </span>
                    Recommended assignment
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 8 }}>
                    <span>Recommended vehicle</span>
                    <strong>
                      {(top.vehicle_plate || 'ABC-1234') +
                        ` — ${top.vehicle_type || 'Heavy truck'} (capacity match)`}
                    </strong>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <span className="dx-mini-badge">Capacity match</span>
                    <span className="dx-mini-badge">Available</span>
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 8 }}>
                    <span>Recommended driver</span>
                    <strong>{top.driver_name}</strong>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <span className="dx-mini-badge">High on-time</span>
                    <span className="dx-mini-badge">Nearest pickup</span>
                    <span className="dx-mini-badge">Available now</span>
                  </div>
                </>
              )}

              <div className="dx-why-box">
                <strong>Why this assignment?</strong>
                <ul>
                  <li>Vehicle capacity exceeds required load.</li>
                  <li>Driver maintains strong on-time performance.</li>
                  <li>Shortest estimated distance from pickup.</li>
                  <li>Fits requested time window.</li>
                </ul>
              </div>

              <div style={{ marginTop: 14 }}>
                <strong style={{ fontSize: '0.875rem' }}>Other matches</strong>
                <div className="dx-data-table-wrap" style={{ marginTop: 8 }}>
                  <table className="dx-data-table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Vehicle</th>
                        <th>Score</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(recommendations.length ? recommendations : []).map((item) => (
                        <tr key={`${item.driver_id}-${item.vehicle_id}`}>
                          <td>{item.driver_name}</td>
                          <td>{item.vehicle_plate}</td>
                          <td>
                            <span className="badge-dx badge-dx--muted">{item.score}</span>
                          </td>
                          <td>
                            {top && item.driver_id === top.driver_id && item.vehicle_id === top.vehicle_id ? (
                              <span className="dx-mini-badge">Recommended</span>
                            ) : (
                              <button
                                type="button"
                                className="btn-dx-primary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => handleAssign(item.driver_id, item.vehicle_id, true)}
                              >
                                Override
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {recommendations.length === 0 && selected && (
                        <tr>
                          <td colSpan={4} style={{ color: 'var(--muted)' }}>
                            No recommendations returned yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="dx-action-row">
                {top ? (
                  <button
                    type="button"
                    className="btn-dx-primary"
                    onClick={() => handleAssign(top.driver_id, top.vehicle_id)}
                  >
                    Apply recommendation
                  </button>
                ) : null}
                <button type="button" className="btn-dx-secondary">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default AssignDriverVehiclePage
