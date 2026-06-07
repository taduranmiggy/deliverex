import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createJobOrder, deleteJobOrder, fetchJobOrders, fetchMasterDataOptions, updateJobOrder } from '../../api/dispatcher'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'
import {
  firstScheduleError,
  minDatetimeLocalValue,
  validateJobSchedule,
} from '../../utils/scheduleValidation'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'

// ─── Blank form state ─────────────────────────────────────────────────────────

const BLANK = {
  client_id: '',
  // Customer name parts
  customer_first_name: '', customer_middle_name: '', customer_last_name: '', customer_suffix: '',
  customer_email: '', customer_contact: '',
  // Pickup address parts
  pickup_province: '', pickup_city: '', pickup_barangay: '', pickup_street: '', pickup_landmark: '',
  // Drop-off address parts
  dropoff_province: '', dropoff_city: '', dropoff_barangay: '', dropoff_street: '', dropoff_landmark: '',
  quarry_id: '',
  material_type_id: '',
  material_specification_id: '',
  load_volume_m3: '',
  scheduled_start: '', scheduled_end: '',
  priority: 'normal', special_handling_instructions: '', notes: '',
}

// ─── Section header component ─────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      borderBottom: '1px solid var(--border, #e5e7eb)',
      paddingBottom: 6,
      marginTop: 12,
      marginBottom: 2,
    }}>
      <span style={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
        {children}
      </span>
    </div>
  )
}

// ─── Job Order Form ───────────────────────────────────────────────────────────

function JobOrderForm({ initial, options, onSaved, onCancel }) {
  const isEdit = Boolean(initial?.id)
  const clients = options.clients || []
  const materialTypes = useMemo(() => options.material_types || [], [options.material_types])
  const quarries = options.quarries || []
  const preferences = options.client_preferences || []

  const findMaterialTypeById = (id) => materialTypes.find((m) => String(m.id) === String(id))
  const findClientById = (id) => clients.find((c) => String(c.id) === String(id))
  const findDefaultPreference = (clientId) => preferences.find((p) => String(p.client_id) === String(clientId) && p.is_default)

  const initialMaterialTypeId = initial?.material_type_id ?? materialTypes.find((m) => m.name === initial?.material_type)?.id ?? ''
  const initialSpecs = findMaterialTypeById(initialMaterialTypeId)?.specifications ?? []
  const initialSpecificationId = initial?.material_specification_id
    ?? initialSpecs.find((s) => s.name === initial?.specification_size)?.id
    ?? ''

  const [form, setForm] = useState(initial ? {
    client_id: initial.client_id ?? '',
    customer_first_name: initial.customer_first_name ?? '',
    customer_middle_name: initial.customer_middle_name ?? '',
    customer_last_name: initial.customer_last_name ?? '',
    customer_suffix: initial.customer_suffix ?? '',
    customer_email: initial.customer_email ?? '',
    customer_contact: initial.customer_contact ?? '',
    pickup_province: initial.pickup_province ?? '',
    pickup_city: initial.pickup_city ?? '',
    pickup_barangay: initial.pickup_barangay ?? '',
    pickup_street: initial.pickup_street ?? '',
    pickup_landmark: initial.pickup_landmark ?? '',
    dropoff_province: initial.dropoff_province ?? '',
    dropoff_city: initial.dropoff_city ?? '',
    dropoff_barangay: initial.dropoff_barangay ?? '',
    dropoff_street: initial.dropoff_street ?? '',
    dropoff_landmark: initial.dropoff_landmark ?? '',
    quarry_id: initial.quarry_id ?? '',
    material_type_id: initialMaterialTypeId,
    material_specification_id: initialSpecificationId,
    load_volume_m3: initial.load_volume_m3 ?? initial.volume_m3 ?? '',
    scheduled_start: initial.scheduled_start ? new Date(initial.scheduled_start).toISOString().slice(0, 16) : '',
    scheduled_end: initial.scheduled_end ? new Date(initial.scheduled_end).toISOString().slice(0, 16) : '',
    priority: initial.priority ?? 'normal',
    special_handling_instructions: initial.special_handling_instructions ?? initial.job_requirements ?? '',
    notes: initial.notes ?? '',
  } : BLANK)

  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const scheduleMin = minDatetimeLocalValue()

  const specOptions = useMemo(() => {
    const selectedType = materialTypes.find((m) => String(m.id) === String(form.material_type_id))
    return selectedType?.specifications || []
  }, [materialTypes, form.material_type_id])

  const set = (k) => (e) => {
    const value = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: value }

      if (k === 'client_id') {
        const selectedClient = findClientById(value)
        if (selectedClient) {
          // Auto-fill contact info
          next.customer_email = selectedClient.email || next.customer_email
          next.customer_contact = selectedClient.phone || next.customer_contact
          // Split client name into first/last if the structured fields are empty
          if (!next.customer_first_name && !next.customer_last_name) {
            const nameParts = (selectedClient.client_name || '').trim().split(/\s+/)
            next.customer_first_name = nameParts[0] || ''
            next.customer_last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''
          }
        }
        const pref = findDefaultPreference(value)
        if (pref?.quarry_id) {
          next.quarry_id = String(pref.quarry_id)
        }
      }

      if (k === 'material_type_id') {
        next.material_specification_id = ''
      }
      return next
    })
    if (fieldErrors[k]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[k]; return n })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    const scheduleErrors = validateJobSchedule({ scheduled_start: form.scheduled_start, scheduled_end: form.scheduled_end })
    const nextFieldErrors = { ...scheduleErrors }

    if (!form.client_id) nextFieldErrors.client_id = 'Client is required.'
    if (!form.customer_first_name) nextFieldErrors.customer_first_name = 'First name is required.'
    if (!form.customer_last_name) nextFieldErrors.customer_last_name = 'Last name is required.'
    if (!form.pickup_province) nextFieldErrors.pickup_province = 'Pickup province is required.'
    if (!form.pickup_city) nextFieldErrors.pickup_city = 'Pickup city is required.'
    if (!form.pickup_street) nextFieldErrors.pickup_street = 'Pickup street / site details are required.'
    if (!form.dropoff_province) nextFieldErrors.dropoff_province = 'Drop-off province is required.'
    if (!form.dropoff_city) nextFieldErrors.dropoff_city = 'Drop-off city is required.'
    if (!form.dropoff_street) nextFieldErrors.dropoff_street = 'Drop-off street / site details are required.'
    if (!form.material_type_id) nextFieldErrors.material_type_id = 'Material type is required.'
    if (!form.material_specification_id) nextFieldErrors.material_specification_id = 'Specification / size is required.'
    if (form.load_volume_m3 === '' || Number.isNaN(Number(form.load_volume_m3))) {
      nextFieldErrors.load_volume_m3 = 'Load volume is required.'
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError(firstScheduleError(nextFieldErrors) || 'Please complete all required fields.')
      setSaving(false)
      return
    }

    const selectedMaterial = materialTypes.find((m) => String(m.id) === String(form.material_type_id))
    const selectedSpecification = specOptions.find((s) => String(s.id) === String(form.material_specification_id))

    const payload = {
      ...form,
      client_id: Number(form.client_id),
      quarry_id: form.quarry_id ? Number(form.quarry_id) : null,
      material_type_id: Number(form.material_type_id),
      material_specification_id: Number(form.material_specification_id),
      material_type: selectedMaterial?.name ?? null,
      specification_size: selectedSpecification?.name ?? null,
      load_volume_m3: form.load_volume_m3 !== '' ? Number(form.load_volume_m3) : null,
      volume_m3: form.load_volume_m3 !== '' ? Number(form.load_volume_m3) : null,
      special_handling_instructions: form.special_handling_instructions || null,
      job_requirements: form.special_handling_instructions || null,
      scheduled_start: form.scheduled_start || null,
      scheduled_end: form.scheduled_end || null,
      // Send empty strings as null for optional address parts
      pickup_barangay: form.pickup_barangay || null,
      pickup_landmark: form.pickup_landmark || null,
      dropoff_barangay: form.dropoff_barangay || null,
      dropoff_landmark: form.dropoff_landmark || null,
      customer_middle_name: form.customer_middle_name || null,
      customer_suffix: form.customer_suffix || null,
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

  const fe = (k) => fieldErrors[k] ? (
    <span className="notice error" style={{ display: 'block', marginTop: 4, fontSize: '0.8125rem', padding: '3px 8px' }}>
      {fieldErrors[k]}
    </span>
  ) : null

  return (
    <form className="dx-panel" style={{ marginTop: 20 }} onSubmit={handleSubmit}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>
        {isEdit ? `Edit Job Order — ${formatJobPublicId(initial.id)}` : 'Create Job Order'}
      </h3>

      {/* ── Client ── */}
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <SectionHeading>Client</SectionHeading>
        <label style={{ gridColumn: '1 / -1' }}>
          Client *
          <select name="client_id" required value={form.client_id} onChange={set('client_id')} aria-invalid={fieldErrors.client_id ? 'true' : undefined}>
            <option value="">— Select client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>
          {fe('client_id')}
        </label>

        {/* ── Customer Information ── */}
        <SectionHeading>Customer Information</SectionHeading>
        <label>
          First Name *
          <input name="customer_first_name" value={form.customer_first_name} onChange={set('customer_first_name')} aria-invalid={fieldErrors.customer_first_name ? 'true' : undefined} />
          {fe('customer_first_name')}
        </label>
        <label>
          Middle Name
          <input name="customer_middle_name" value={form.customer_middle_name} onChange={set('customer_middle_name')} placeholder="Optional" />
        </label>
        <label>
          Last Name *
          <input name="customer_last_name" value={form.customer_last_name} onChange={set('customer_last_name')} aria-invalid={fieldErrors.customer_last_name ? 'true' : undefined} />
          {fe('customer_last_name')}
        </label>
        <label>
          Suffix
          <input name="customer_suffix" value={form.customer_suffix} onChange={set('customer_suffix')} placeholder="e.g. Jr., Sr., III" />
        </label>
        <label>
          Customer Email
          <input name="customer_email" type="email" value={form.customer_email} onChange={set('customer_email')} />
        </label>
        <label>
          Contact Number
          <input name="customer_contact" value={form.customer_contact} onChange={set('customer_contact')} />
        </label>

        {/* ── Pickup Location ── */}
        <SectionHeading>Pickup Location</SectionHeading>
        <label>
          Province *
          <input name="pickup_province" value={form.pickup_province} onChange={set('pickup_province')} aria-invalid={fieldErrors.pickup_province ? 'true' : undefined} />
          {fe('pickup_province')}
        </label>
        <label>
          City / Municipality *
          <input name="pickup_city" value={form.pickup_city} onChange={set('pickup_city')} aria-invalid={fieldErrors.pickup_city ? 'true' : undefined} />
          {fe('pickup_city')}
        </label>
        <label>
          Barangay
          <input name="pickup_barangay" value={form.pickup_barangay} onChange={set('pickup_barangay')} placeholder="Optional" />
        </label>
        <label>
          Landmark
          <input name="pickup_landmark" value={form.pickup_landmark} onChange={set('pickup_landmark')} placeholder="Optional" />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Street / Lot / Building / Site Details *
          <input name="pickup_street" value={form.pickup_street} onChange={set('pickup_street')} placeholder="e.g. Lot 5 Block 2, Quezon Ave" aria-invalid={fieldErrors.pickup_street ? 'true' : undefined} />
          {fe('pickup_street')}
        </label>

        {/* ── Drop-off Location ── */}
        <SectionHeading>Drop-off Location</SectionHeading>
        <label>
          Province *
          <input name="dropoff_province" value={form.dropoff_province} onChange={set('dropoff_province')} aria-invalid={fieldErrors.dropoff_province ? 'true' : undefined} />
          {fe('dropoff_province')}
        </label>
        <label>
          City / Municipality *
          <input name="dropoff_city" value={form.dropoff_city} onChange={set('dropoff_city')} aria-invalid={fieldErrors.dropoff_city ? 'true' : undefined} />
          {fe('dropoff_city')}
        </label>
        <label>
          Barangay
          <input name="dropoff_barangay" value={form.dropoff_barangay} onChange={set('dropoff_barangay')} placeholder="Optional" />
        </label>
        <label>
          Landmark
          <input name="dropoff_landmark" value={form.dropoff_landmark} onChange={set('dropoff_landmark')} placeholder="Optional" />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Street / Lot / Building / Site Details *
          <input name="dropoff_street" value={form.dropoff_street} onChange={set('dropoff_street')} placeholder="e.g. Construction Site, EDSA cor. Shaw" aria-invalid={fieldErrors.dropoff_street ? 'true' : undefined} />
          {fe('dropoff_street')}
        </label>

        {/* ── Delivery Details ── */}
        <SectionHeading>Delivery Details</SectionHeading>
        <label>
          Quarry / Supplier
          <select name="quarry_id" value={form.quarry_id} onChange={set('quarry_id')}>
            <option value="">— Auto-filled by client preference —</option>
            {quarries.map((q) => <option key={q.id} value={q.id}>{q.quarry_name}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label>
          Material Type *
          <select name="material_type_id" required value={form.material_type_id} onChange={set('material_type_id')} aria-invalid={fieldErrors.material_type_id ? 'true' : undefined}>
            <option value="">— Select material type —</option>
            {materialTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {fe('material_type_id')}
        </label>
        <label>
          Specification / Size *
          <select name="material_specification_id" required value={form.material_specification_id} onChange={set('material_specification_id')} aria-invalid={fieldErrors.material_specification_id ? 'true' : undefined}>
            <option value="">— Select specification —</option>
            {specOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {fe('material_specification_id')}
        </label>
        <label>
          Load Volume (m³) *
          <input name="load_volume_m3" type="number" step="0.001" min="0" value={form.load_volume_m3} onChange={set('load_volume_m3')} aria-invalid={fieldErrors.load_volume_m3 ? 'true' : undefined} />
          {fe('load_volume_m3')}
        </label>
        <div /> {/* spacer */}
        <label>
          Scheduled Start
          <input name="scheduled_start" type="datetime-local" min={scheduleMin} value={form.scheduled_start} onChange={set('scheduled_start')} aria-invalid={fieldErrors.scheduled_start ? 'true' : undefined} />
          {fe('scheduled_start')}
        </label>
        <label>
          Scheduled End
          <input name="scheduled_end" type="datetime-local" min={form.scheduled_start || scheduleMin} value={form.scheduled_end} onChange={set('scheduled_end')} aria-invalid={fieldErrors.scheduled_end ? 'true' : undefined} />
          {fe('scheduled_end')}
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Special Handling Instructions
          <textarea name="special_handling_instructions" rows="2" placeholder="Permits, handling, site access…" value={form.special_handling_instructions} onChange={set('special_handling_instructions')} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Notes
          <textarea name="notes" rows="2" placeholder="Internal dispatcher notes…" value={form.notes} onChange={set('notes')} />
        </label>

        {error && <p className="notice error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, gridColumn: '1 / -1' }}>
          <button type="submit" className="btn-dx-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create Job Order'}
          </button>
          <button type="button" className="btn-dx-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CreateJobOrderPage() {
  const [orders, setOrders] = useState([])
  const [masterData, setMasterData] = useState({ clients: [], material_types: [], quarries: [], client_preferences: [] })
  const [selected, setSelected] = useState(null)
  const [formMode, setFormMode] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [jobsRes, optionsRes] = await Promise.all([fetchJobOrders(1), fetchMasterDataOptions()])
      setOrders(jobsRes.data || [])
      setMasterData({
        clients: optionsRes.clients || [],
        material_types: optionsRes.material_types || [],
        quarries: optionsRes.quarries || [],
        client_preferences: optionsRes.client_preferences || [],
      })
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
        {/* ── Table ── */}
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
                    <td>{order.client?.client_name || buildDisplayName(order)}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{order.priority}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {order.scheduled_start ? new Date(order.scheduled_start).toLocaleDateString() : '—'}
                    </td>
                    <td><span className={jobStatusBadgeClass(order.status)}>{formatJobStatus(order.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Detail panel ── */}
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
                <div className="dx-kv"><span>Client</span><strong>{selected.client?.client_name || buildDisplayName(selected)}</strong></div>
                <div className="dx-kv"><span>Customer</span><strong>{buildDisplayName(selected) || '—'}</strong></div>
                <div className="dx-kv"><span>Contact</span><strong>{selected.customer_contact ?? selected.customer_email ?? '—'}</strong></div>
                <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                  <span>Pickup</span>
                  <strong style={{ textAlign: 'right' }}>{buildDisplayAddress('pickup', selected) || '—'}</strong>
                </div>
                <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                  <span>Drop-off</span>
                  <strong style={{ textAlign: 'right' }}>{buildDisplayAddress('dropoff', selected) || '—'}</strong>
                </div>
                {selected.pickup_landmark && (
                  <div className="dx-kv"><span>Pickup landmark</span><strong>{selected.pickup_landmark}</strong></div>
                )}
                {selected.dropoff_landmark && (
                  <div className="dx-kv"><span>Drop-off landmark</span><strong>{selected.dropoff_landmark}</strong></div>
                )}
                {selected.material_type && (
                  <div className="dx-kv"><span>Material type</span><strong>{selected.material_type}</strong></div>
                )}
                <div className="dx-kv"><span>Quarry / Supplier</span><strong>{selected.quarry?.quarry_name || '—'}</strong></div>
                <div className="dx-kv"><span>Specification</span><strong>{selected.specification_size || '—'}</strong></div>
                <div className="dx-kv"><span>Load</span>
                  <strong>{selected.load_volume_m3 || selected.volume_m3 ? `${selected.load_volume_m3 ?? selected.volume_m3} m³` : '—'}</strong>
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
                    <span>Special handling</span><strong>{selected.job_requirements}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-dx-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => setFormMode({ order: selected })}>
                    Edit
                  </button>
                  {selected.status === 'pending' && (
                    <Link to="/dispatcher/dispatch-best-fit" className="btn-dx-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                      Dispatch
                    </Link>
                  )}
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
        <JobOrderForm initial={null} options={masterData} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
      )}
      {formMode?.order && (
        <JobOrderForm initial={formMode.order} options={masterData} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
      )}
    </section>
  )
}

export default CreateJobOrderPage
