import { useEffect, useState } from 'react'
import { createJobOrder, fetchJobOrders } from '../../api/dispatcher'
import { formatDemoPhp, formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'

function CreateJobOrderPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const loadOrders = async () => {
    try {
      const response = await fetchJobOrders(1)
      setOrders(response.data || [])
      setSelected((prev) => {
        if (prev && response.data?.some((o) => o.id === prev.id)) return prev
        return response.data?.[0] ?? null
      })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    const formData = new FormData(event.target)
    const weightRaw = formData.get('weight_kg')
    const volumeRaw = formData.get('volume_m3')
    const payload = {
      customer_name: formData.get('customer_name'),
      customer_contact: formData.get('customer_contact'),
      pickup_location: formData.get('pickup_location'),
      dropoff_location: formData.get('dropoff_location'),
      vehicle_type_required: formData.get('vehicle_type_required'),
      vehicle_capacity_required: formData.get('vehicle_capacity_required'),
      job_requirements: formData.get('job_requirements'),
      scheduled_start: formData.get('scheduled_start') || null,
      scheduled_end: formData.get('scheduled_end') || null,
      priority: formData.get('priority') || 'normal',
      weight_kg: weightRaw !== '' && weightRaw != null ? Number(weightRaw) : null,
      volume_m3: volumeRaw !== '' && volumeRaw != null ? Number(volumeRaw) : null,
    }

    try {
      const response = await createJobOrder(payload)
      setMessage(`Job order created. Tracking code: ${response.tracking_code}`)
      await loadOrders()
      event.target.reset()
    } catch (err) {
      setError(err.message)
    }
  }

  const firstAssignment =
    selected?.assignments?.[0] ??
    selected?.assignment ??
    selected?.dispatch_assignments?.[0]

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Job Orders</h1>
          <p>View and manage all job orders</p>
        </div>
        <button
          className="btn-dx-primary"
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          style={{ height: 'fit-content', alignSelf: 'center' }}
        >
          {showForm ? 'Close Form' : 'New Job Order'}
        </button>
      </header>
      {error && <p className="notice error">{error}</p>}

      <div className="dx-split-bestfit" style={{ gridTemplateColumns: '1fr 380px', gap: 20 }}>
        <div className="dx-panel" style={{ marginBottom: 0 }}>
          <div className="dx-data-table-wrap">
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Client</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Pickup</th>
                  <th>Drop-off</th>
                  <th>Schedule / priority</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No job orders yet.
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(order)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(order)
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      outline: selected?.id === order.id ? '2px solid var(--primary)' : 'none',
                    }}
                  >
                    <td>
                      <span className="job-link">{formatJobPublicId(order.id)}</span>
                    </td>
                    <td>{order.customer_name}</td>
                    <td>{order.vehicle_type_required ?? '—'}</td>
                    <td>{order.vehicle_capacity_required ?? '—'}</td>
                    <td>{order.pickup_location}</td>
                    <td>{order.dropoff_location}</td>
                    <td>
                      {[order.priority, order.scheduled_start ? new Date(order.scheduled_start).toLocaleString() : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td>{formatDemoPhp(order.id)}</td>
                    <td>
                      <span className={jobStatusBadgeClass(order.status)}>
                        {formatJobStatus(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dx-detail-panel" style={{ marginBottom: 0 }}>
          <div className="dx-detail-panel__top">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>
                {selected ? formatJobPublicId(selected.id) : 'Job details'}
              </h2>
            </div>
            {selected && (
              <button
                type="button"
                className="dx-detail-panel__close"
                aria-label="Clear selection"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            )}
          </div>
          <div className="dx-detail-panel__body">
            {selected ? (
              <>
                <div className="dx-kv">
                  <span>Client</span>
                  <strong>{selected.customer_name}</strong>
                </div>
                <div className="dx-kv">
                  <span>Material & quantity</span>
                  <strong>
                    {[selected.vehicle_type_required, selected.vehicle_capacity_required]
                      .filter(Boolean)
                      .join(' — ') || '—'}
                  </strong>
                </div>
                <div className="dx-kv">
                  <span>Route</span>
                  <strong>
                    {selected.pickup_location} to {selected.dropoff_location}
                  </strong>
                </div>
                <div className="dx-kv">
                  <span>Schedule</span>
                  <strong>
                    {selected.scheduled_start
                      ? new Date(selected.scheduled_start).toLocaleString()
                      : '—'}
                    {selected.scheduled_end
                      ? ` – ${new Date(selected.scheduled_end).toLocaleString()}`
                      : ''}
                  </strong>
                </div>
                <div className="dx-kv">
                  <span>Load (weight / volume / priority)</span>
                  <strong>
                    {[selected.weight_kg != null ? `${selected.weight_kg} kg` : null, selected.volume_m3 != null ? `${selected.volume_m3} m³` : null, selected.priority]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </strong>
                </div>
                <div className="dx-kv">
                  <span>Amount</span>
                  <strong>{formatDemoPhp(selected.id)}</strong>
                </div>
                <div>
                  <span className={jobStatusBadgeClass(selected.status)}>
                    {formatJobStatus(selected.status)}
                  </span>
                </div>
                <div className="dx-kv">
                  <span>Assigned driver</span>
                  <strong>{firstAssignment?.driver?.user?.name ?? '—'}</strong>
                </div>
                <div className="dx-kv">
                  <span>Assigned vehicle</span>
                  <strong>{firstAssignment?.vehicle?.plate_no ?? '—'}</strong>
                </div>
                <div className="dx-kv">
                  <span>Timeline — created</span>
                  <strong>
                    {selected.created_at
                      ? new Date(selected.created_at).toLocaleString()
                      : '—'}
                  </strong>
                </div>
                <div className="dx-kv">
                  <span>Proof of Delivery</span>
                  <strong>Not yet available</strong>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: 'var(--muted)' }}>Select a job to view details.</p>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <form className="dx-panel form-grid" style={{ marginTop: 20 }} onSubmit={handleSubmit}>
          <h3 style={{ margin: '0 0 8px' }}>Create job order</h3>
          <label>
            Customer Name
            <input name="customer_name" type="text" placeholder="Customer name" required />
          </label>
          <label>
            Contact Number
            <input name="customer_contact" type="text" placeholder="Phone or email" />
          </label>
          <label>
            Pickup Location
            <input name="pickup_location" type="text" placeholder="Pickup address" required />
          </label>
          <label>
            Drop-off Location
            <input name="dropoff_location" type="text" placeholder="Drop-off address" required />
          </label>
          <label>
            Vehicle Type
            <input name="vehicle_type_required" type="text" placeholder="e.g. Gravel haul" />
          </label>
          <label>
            Vehicle Capacity / Quantity
            <input name="vehicle_capacity_required" type="text" placeholder="e.g. 10 tons" />
          </label>
          <label>
            Weight (kg)
            <input name="weight_kg" type="number" step="0.01" min="0" placeholder="Optional — for best-fit capacity" />
          </label>
          <label>
            Volume (m³)
            <input name="volume_m3" type="number" step="0.001" min="0" placeholder="Optional" />
          </label>
          <label>
            Scheduled start
            <input name="scheduled_start" type="datetime-local" />
          </label>
          <label>
            Scheduled end
            <input name="scheduled_end" type="datetime-local" />
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="normal">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            Job Requirements
            <textarea name="job_requirements" rows="3" placeholder="Special instructions" />
          </label>
          {message && <p className="notice">{message}</p>}
          {error && <p className="notice error">{error}</p>}
          <button type="submit" className="btn-dx-primary">
            Save Job Order
          </button>
        </form>
      )}
    </section>
  )
}

export default CreateJobOrderPage
