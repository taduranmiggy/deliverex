import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createAssignment, fetchDispatchOptions, fetchJobOrders } from '../../api/dispatcher'
import { useToast } from '../../context/ToastContext'
import { IconRouteArrow } from '../../components/DxIcons'
import { formatJobPublicId } from '../../utils/formatPhp'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import { formatJobSchedule } from '../../utils/driverAssignment'
import { CheckCircle2, Loader2, Truck, User } from 'lucide-react'

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 }

const PRIORITY_BADGE = {
  urgent: { label: 'URGENT', color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5' },
  high:   { label: 'HIGH',   color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  normal: { label: 'NORMAL', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  low:    { label: 'LOW',    color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.normal
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em',
      padding: '1px 7px', borderRadius: 99,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  )
}

function AssignDriverVehiclePage() {
  const toast = useToast()
  const [jobOrders, setJobOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [options, setOptions] = useState({ drivers: [], vehicles: [] })
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const location = useLocation()
  const preselectJobId = location.state?.jobOrderId ?? null

  const loadJobs = async () => {
    try {
      const res = await fetchJobOrders(1)
      const pending = (res.data || []).filter((item) => item.status === 'pending')
      const sorted = [...pending].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 2
        const pb = PRIORITY_ORDER[b.priority] ?? 2
        if (pa !== pb) return pa - pb
        const ta = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity
        const tb = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity
        return ta - tb
      })
      setJobOrders(sorted)
      setSelected((prev) => {
        if (preselectJobId) {
          const requested = pending.find((p) => p.id === preselectJobId)
          if (requested) return requested
        }
        if (prev && pending.some((p) => p.id === prev.id)) return prev
        return pending[0] ?? null
      })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadJobs() }, []) // eslint-disable-line

  useEffect(() => {
    if (!selected) {
      setOptions({ drivers: [], vehicles: [] })
      setDriverId('')
      setVehicleId('')
      return
    }
    setLoading(true)
    setDriverId('')
    setVehicleId('')
    fetchDispatchOptions(selected.id)
      .then((res) => setOptions(res.options || { drivers: [], vehicles: [] }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selected])

  const selectedDriver = options.drivers.find((d) => String(d.id) === String(driverId))
  const selectedVehicle = options.vehicles.find((v) => String(v.id) === String(vehicleId))

  const handleAssign = async () => {
    if (!selected) {
      setError('Select a job order first.')
      return
    }
    if (!driverId || !vehicleId) {
      setError('Select both a driver and a vehicle.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createAssignment({
        job_order_id: selected.id,
        driver_id: Number(driverId),
        vehicle_id: Number(vehicleId),
      })
      toast(`Dispatched — ${selectedDriver?.name ?? 'Driver'} assigned.`, 'success')
      await loadJobs()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Fleet Dispatch</h1>
          <p>Assign an available driver and vehicle to a pending job order</p>
        </div>
      </header>

      {error && <p className="notice error" style={{ marginBottom: 14 }}>{error}</p>}

      <div className="dx-dispatch-grid" style={{ gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1fr)' }}>
        <div>
          <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--navy)' }}>{jobOrders.length}</strong> pending
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Select job</span>
          </div>
          {jobOrders.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              No unassigned jobs.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobOrders.map((order) => {
                const isActive = selected?.id === order.id
                return (
                  <button key={order.id} type="button" onClick={() => setSelected(order)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--stroke)'}`,
                      borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                      background: isActive ? '#eff6ff' : '#fff',
                      boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem', color: isActive ? 'var(--color-primary)' : 'var(--muted)' }}>
                        {formatJobPublicId(order.id)}
                      </span>
                      <PriorityBadge priority={order.priority} />
                    </div>
                    <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.875rem' }}>
                      {order.client?.client_name || order.custom_client_name || buildDisplayName(order)}
                    </p>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{buildDisplayAddress('pickup', order)}</span>
                      <span style={{ flexShrink: 0 }}><IconRouteArrow /></span>
                      <span>{buildDisplayAddress('dropoff', order)}</span>
                    </p>
                    {(order.scheduled_start || order.scheduled_end) && (
                      <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--muted)' }}>
                        {formatJobSchedule(order)}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          {!selected ? (
            <div style={{ background: '#fff', border: '1px dashed var(--stroke)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Select a job order to assign a driver and vehicle</p>
            </div>
          ) : loading ? (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={20} style={{ animation: 'spin 0.7s linear infinite' }} />
              Loading available resources…
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--stroke)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                  {formatJobPublicId(selected.id)} · {selected.client?.client_name || selected.custom_client_name || buildDisplayName(selected)}
                </p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  {[selected.material_type, selected.specification_size].filter(Boolean).join(' · ')}
                  {(selected.load_volume_m3 || selected.volume_m3) ? ` · ${selected.load_volume_m3 ?? selected.volume_m3} m³` : ''}
                </p>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} /> Driver</span>
                <select value={driverId} onChange={(e) => setDriverId(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--stroke)', font: 'inherit' }}>
                  <option value="">Select available driver…</option>
                  {options.drivers.map((d) => (
                    <option key={d.id} value={d.id} disabled={!d.has_login_account}>
                      {d.name}{!d.has_login_account ? ' (no account)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={14} /> Vehicle</span>
                <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--stroke)', font: 'inherit' }}>
                  <option value="">Select available vehicle…</option>
                  {options.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_no}{v.vehicle_type ? ` · ${v.vehicle_type}` : ''}{v.cbm_capacity ? ` · ${v.cbm_capacity} m³` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedDriver && selectedVehicle && (
                <div style={{ background: 'var(--slate-50)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--stroke)', fontSize: '0.8125rem' }}>
                  <strong>{selectedDriver.name}</strong> · <strong>{selectedVehicle.plate_no}</strong>
                </div>
              )}

              {options.drivers.length === 0 || options.vehicles.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  No available drivers or vehicles match this job schedule and capacity.
                </p>
              ) : null}

              <button type="button" className="btn-dx-primary btn-sm" onClick={handleAssign}
                disabled={submitting || !driverId || !vehicleId || !selectedDriver?.has_login_account}
                style={{ alignSelf: 'flex-start' }}>
                {submitting
                  ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Assigning…</>
                  : <><CheckCircle2 size={15} /> Assign Driver & Vehicle</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default AssignDriverVehiclePage
