import { useCallback, useEffect, useState } from 'react'
import { createJobOrder, deleteJobOrder, fetchJobOrders, updateJobOrder } from '../../api/dispatcher'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'

const BLANK = {
  customer_name: '', customer_email: '', customer_contact: '',
  pickup_location: '', dropoff_location: '',
  vehicle_type_required: '', vehicle_capacity_required: '',
  weight_kg: '', volume_m3: '',
  scheduled_start: '', scheduled_end: '',
  priority: 'normal', job_requirements: '',
}

function JobOrderForm({ initial, onSaved, onCancel }) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState(initial ? {
    customer_name: initial.customer_name ?? '',
    customer_email: initial.customer_email ?? '',
    customer_contact: initial.customer_contact ?? '',
    pickup_location: initial.pickup_location ?? '',
    dropoff_location: initial.dropoff_location ?? '',
    vehicle_type_required: initial.vehicle_type_required ?? '',
    vehicle_capacity_required: initial.vehicle_capacity_required ?? '',
    weight_kg: initial.weight_kg ?? '',
    volume_m3: initial.volume_m3 ?? '',
    scheduled_start: initial.scheduled_start ? new Date(initial.scheduled_start).toISOString().slice(0, 16) : '',
    scheduled_end: initial.scheduled_end ? new Date(initial.scheduled_end).toISOString().slice(0, 16) : '',
    priority: initial.priority ?? 'normal',
    job_requirements: initial.job_requirements ?? '',
  } : BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      weight_kg: form.weight_kg !== '' ? Number(form.weight_kg) : null,
      volume_m3: form.volume_m3 !== '' ? Number(form.volume_m3) : null,
      scheduled_start: form.scheduled_start || null,
      scheduled_end: form.scheduled_end || null,
    }
    try {
      const saved = isEdit
        ? await updateJobOrder(initial.id, payload)
        : await createJobOrder(payload)
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="dx-panel form-grid" style={{ marginTop: 20 }} onSubmit={handleSubmit}>
      <h3 style={{ margin: '0 0 8px', gridColumn: '1 / -1' }}>
        {isEdit ? `Edit Job Order — ${formatJobPublicId(initial.id)}` : 'Create Job Order'}
      </h3>
      <label>Customer Name <input name="customer_name" required value={form.customer_name} onChange={set('customer_name')} /></label>
      <label>Customer Email <input name="customer_email" type="email" required value={form.customer_email} onChange={set('customer_email')} /></label>
      <label>Contact Number <input name="customer_contact" value={form.customer_contact} onChange={set('customer_contact')} /></label>
      <label>Pickup Location <input name="pickup_location" required value={form.pickup_location} onChange={set('pickup_location')} /></label>
      <label>Drop-off Location <input name="dropoff_location" required value={form.dropoff_location} onChange={set('dropoff_location')} /></label>
      <label>Vehicle Type <input name="vehicle_type_required" placeholder="Dump Truck, Flatbed…" value={form.vehicle_type_required} onChange={set('vehicle_type_required')} /></label>
      <label>Vehicle Capacity <input name="vehicle_capacity_required" placeholder="10T, 5T…" value={form.vehicle_capacity_required} onChange={set('vehicle_capacity_required')} /></label>
      <label>Weight (kg) <input name="weight_kg" type="number" step="0.01" min="0" value={form.weight_kg} onChange={set('weight_kg')} /></label>
      <label>Volume (m³) <input name="volume_m3" type="number" step="0.001" min="0" value={form.volume_m3} onChange={set('volume_m3')} /></label>
      <label>Scheduled start <input name="scheduled_start" type="datetime-local" value={form.scheduled_start} onChange={set('scheduled_start')} /></label>
      <label>Scheduled end <input name="scheduled_end" type="datetime-local" value={form.scheduled_end} onChange={set('scheduled_end')} /></label>
      <label>Priority
        <select name="priority" value={form.priority} onChange={set('priority')}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label style={{ gridColumn: '1 / -1' }}>
        Job Requirements
        <textarea name="job_requirements" rows="3" placeholder="Special instructions…" value={form.job_requirements} onChange={set('job_requirements')} />
      </label>
      {error && <p className="notice error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, gridColumn: '1 / -1' }}>
        <button type="submit" className="btn-dx-primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create Job Order'}
        </button>
        <button type="button" className="btn-dx-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function CreateJobOrderPage() {
  const [orders, setOrders]   = useState([])
  const [selected, setSelected] = useState(null)
  const [formMode, setFormMode] = useState(null) // null | 'create' | { order }
  const [message, setMessage] = useState('')
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetchJobOrders(1)
      const data = res.data || []
      setOrders(data)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleSaved = (saved, isEdit) => {
    setFormMode(null)
    setMessage(`Job order ${isEdit ? 'updated' : 'created'}. Tracking code: ${saved.tracking_code ?? saved.data?.tracking_code ?? ''}`)
    setTimeout(() => setMessage(''), 5000)
    load()
    setSelected(saved)
  }

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete job order ${formatJobPublicId(order.id)}? This cannot be undone.`)) return
    setError('')
    try {
      await deleteJobOrder(order.id)
      setMessage(`Job order ${formatJobPublicId(order.id)} deleted.`)
      setTimeout(() => setMessage(''), 3000)
      setSelected(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const firstAssignment = selected?.assignments?.[0]

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Job Orders</h1>
          <p>View and manage all job orders</p>
        </div>
        <button className="btn-dx-primary" type="button" onClick={() => { setFormMode('create'); setSelected(null) }}
          style={{ height: 'fit-content', alignSelf: 'center' }}>
          + New Job Order
        </button>
      </header>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <div className="dx-split-bestfit" style={{ gridTemplateColumns: '1fr 360px', gap: 20 }}>
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Job ID</th><th>Client</th><th>Route</th><th>Priority</th>
                  <th>Schedule</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>No job orders yet.</td></tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id} role="button" tabIndex={0}
                    onClick={() => { setSelected(order); setFormMode(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(order); setFormMode(null) } }}
                    style={{ cursor: 'pointer', outline: selected?.id === order.id ? '2px solid var(--primary)' : 'none' }}
                  >
                    <td><span className="job-link">{formatJobPublicId(order.id)}</span></td>
                    <td>{order.customer_name}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {order.pickup_location} → {order.dropoff_location}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{order.priority}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {order.scheduled_start ? new Date(order.scheduled_start).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className={jobStatusBadgeClass(order.status)}>{formatJobStatus(order.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        <div className="dx-detail-panel" style={{ marginBottom: 0 }}>
          <div className="dx-detail-panel__top">
            <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>
              {selected ? formatJobPublicId(selected.id) : 'Job details'}
            </h2>
            {selected && (
              <button type="button" className="dx-detail-panel__close" aria-label="Clear selection" onClick={() => setSelected(null)}>×</button>
            )}
          </div>
          <div className="dx-detail-panel__body">
            {selected ? (
              <>
                <div className="dx-kv"><span>Client</span><strong>{selected.customer_name}</strong></div>
                <div className="dx-kv"><span>Contact</span><strong>{selected.customer_contact ?? selected.customer_email}</strong></div>
                <div className="dx-kv"><span>Route</span><strong>{selected.pickup_location} → {selected.dropoff_location}</strong></div>
                <div className="dx-kv"><span>Vehicle req.</span>
                  <strong>{[selected.vehicle_type_required, selected.vehicle_capacity_required].filter(Boolean).join(' — ') || '—'}</strong>
                </div>
                <div className="dx-kv"><span>Load</span>
                  <strong>{[selected.weight_kg ? `${selected.weight_kg} kg` : null, selected.volume_m3 ? `${selected.volume_m3} m³` : null].filter(Boolean).join(' · ') || '—'}</strong>
                </div>
                <div className="dx-kv"><span>Schedule</span>
                  <strong>
                    {selected.scheduled_start ? new Date(selected.scheduled_start).toLocaleString() : '—'}
                    {selected.scheduled_end ? ` – ${new Date(selected.scheduled_end).toLocaleString()}` : ''}
                  </strong>
                </div>
                <div className="dx-kv"><span>Priority</span><strong style={{ textTransform: 'capitalize' }}>{selected.priority}</strong></div>
                <div><span className={jobStatusBadgeClass(selected.status)}>{formatJobStatus(selected.status)}</span></div>
                <div className="dx-kv"><span>Tracking code</span><strong>{selected.tracking_code}</strong></div>
                <div className="dx-kv"><span>Assigned driver</span><strong>{firstAssignment?.driver?.user?.name ?? '—'}</strong></div>
                <div className="dx-kv"><span>Assigned vehicle</span><strong>{firstAssignment?.vehicle?.plate_no ?? '—'}</strong></div>
                {selected.job_requirements && (
                  <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                    <span>Requirements</span><strong>{selected.job_requirements}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn-dx-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => setFormMode({ order: selected })}>
                    Edit
                  </button>
                  {['pending', 'cancelled'].includes(selected.status) && (
                    <button type="button" style={{ fontSize: '0.8rem', padding: '6px 12px', color: 'var(--error, #dc2626)', border: '1px solid currentColor', borderRadius: 8, background: 'none', cursor: 'pointer' }}
                      onClick={() => handleDelete(selected)}>
                      Delete
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: 'var(--muted)' }}>Select a job to view details.</p>
            )}
          </div>
        </div>
      </div>

      {formMode === 'create' && (
        <JobOrderForm initial={null} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
      )}
      {formMode?.order && (
        <JobOrderForm initial={formMode.order} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
      )}
    </section>
  )
}

export default CreateJobOrderPage
