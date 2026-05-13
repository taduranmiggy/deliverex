import { useEffect, useState } from 'react'
import { createAssignment, fetchJobOrders, getBestFit } from '../../api/dispatcher'
import { IconCheckSmall, IconRouteArrow } from '../../components/DxIcons'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus } from '../../utils/statusLabels'

function AssignDriverVehiclePage() {
  const [jobOrders, setJobOrders]       = useState([])
  const [selected, setSelected]         = useState(null)
  const [recommended, setRecommended]   = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading]           = useState(false)
  const [message, setMessage]           = useState('')
  const [error, setError]               = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchJobOrders(1)
        const pending = (res.data || []).filter((item) => item.status === 'pending')
        setJobOrders(pending)
        setSelected((prev) => {
          if (prev && pending.some((p) => p.id === prev.id)) return prev
          return pending[0] ?? null
        })
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selected) { setRecommendations([]); setRecommended(null); return }
    setLoading(true)
    getBestFit(selected.id)
      .then((res) => {
        setRecommended(res.recommended || null)
        setRecommendations(res.recommendations || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selected])

  const handleAssign = async (driverId, vehicleId, isOverride = false) => {
    if (!selected) { setError('Select a job order first.'); return }
    if (isOverride && !window.confirm('This differs from the recommended pairing. Continue with override?')) return
    setError('')
    setMessage('')
    try {
      await createAssignment({ job_order_id: selected.id, driver_id: driverId, vehicle_id: vehicleId })
      setMessage('Assignment created and driver notified.')
      const res = await fetchJobOrders(1)
      const pending = (res.data || []).filter((item) => item.status === 'pending')
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
      {error   && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit">
        <div>
          <div className="dx-panel" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--navy)' }}>{jobOrders.length}</strong> jobs pending assignment
            </p>
          </div>
          {jobOrders.length === 0 && (
            <div className="dx-panel"><p style={{ margin: 0, color: 'var(--muted)' }}>No unassigned jobs.</p></div>
          )}
          {jobOrders.map((order) => (
            <button key={order.id} type="button"
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
              <p className="dx-route-inline" style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                <span>{order.pickup_location}</span>
                <span className="dx-route-inline__arrow" aria-hidden><IconRouteArrow /></span>
                <span>{order.dropoff_location}</span>
              </p>
              {order.scheduled_start && (
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {new Date(order.scheduled_start).toLocaleString()}
                  {order.scheduled_end ? ` — ${new Date(order.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="dx-panel">
          <h3 className="dx-panel-title">Recommendation Panel</h3>
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>Select a job to view recommendations.</p>
          ) : loading ? (
            <p style={{ color: 'var(--muted)' }}>Analyzing available resources…</p>
          ) : (
            <>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Vehicle required</span>
                <strong>{[selected.vehicle_type_required, selected.vehicle_capacity_required].filter(Boolean).join(' · ') || '—'}</strong>
              </div>
              <div className="dx-kv" style={{ marginBottom: 14 }}>
                <span>Payload</span>
                <strong>
                  {[selected.weight_kg ? `${selected.weight_kg} kg` : null, selected.volume_m3 ? `${selected.volume_m3} m³` : null]
                    .filter(Boolean).join(' · ') || '—'}
                </strong>
              </div>
              {selected.scheduled_end && (
                <div className="dx-kv" style={{ marginBottom: 14 }}>
                  <span>Deadline</span>
                  <strong>{new Date(selected.scheduled_end).toLocaleString()}</strong>
                </div>
              )}

              {top ? (
                <>
                  <div className="dx-bestfit-banner" role="status">
                    <span className="dx-bestfit-banner__icon" aria-hidden><IconCheckSmall /></span>
                    Recommended assignment
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 8 }}>
                    <span>Driver</span>
                    <strong>{top.driver_name}</strong>
                  </div>
                  <div className="dx-kv" style={{ marginBottom: 12 }}>
                    <span>Vehicle</span>
                    <strong>
                      {top.vehicle_plate}
                      {top.vehicle_type ? ` — ${top.vehicle_type}` : ''}
                      {top.vehicle_capacity ? ` (${top.vehicle_capacity})` : ''}
                    </strong>
                  </div>

                  {/* Dynamic BestFit reasons */}
                  {Array.isArray(top.reasons) && top.reasons.length > 0 && (
                    <div className="dx-why-box">
                      <strong>Why this assignment?</strong>
                      <ul>
                        {top.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="dx-why-box">
                  <strong>No recommendations</strong>
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    No available drivers or vehicles match the requirements. Check fleet availability in Master Data.
                  </p>
                </div>
              )}

              {recommendations.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <strong style={{ fontSize: '0.875rem' }}>All matches</strong>
                  <div className="dx-data-table-wrap" style={{ marginTop: 8 }}>
                    <table className="dx-data-table">
                      <thead><tr><th>Driver</th><th>Vehicle</th><th>Score</th><th /></tr></thead>
                      <tbody>
                        {recommendations.map((item) => {
                          const isTop = top && item.driver_id === top.driver_id && item.vehicle_id === top.vehicle_id
                          return (
                            <tr key={`${item.driver_id}-${item.vehicle_id}`}>
                              <td>{item.driver_name}</td>
                              <td>{item.vehicle_plate}</td>
                              <td><span className="badge-dx badge-dx--muted">{item.score}</span></td>
                              <td>
                                {isTop ? (
                                  <span className="dx-mini-badge">Recommended</span>
                                ) : (
                                  <button type="button" className="btn-dx-primary"
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                    onClick={() => handleAssign(item.driver_id, item.vehicle_id, true)}>
                                    Override
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="dx-action-row">
                {top && (
                  <button type="button" className="btn-dx-primary" onClick={() => handleAssign(top.driver_id, top.vehicle_id)}>
                    Apply recommendation
                  </button>
                )}
                <button type="button" className="btn-dx-secondary" onClick={() => setSelected(null)}>
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
