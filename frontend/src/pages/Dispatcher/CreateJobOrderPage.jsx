import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createJobOrder, deleteJobOrder, fetchClientHistory, fetchJobOrders, fetchMasterDataOptions, updateJobOrder } from '../../api/dispatcher'
import ClientCombobox from '../../components/ClientCombobox'
import CustomerHistoryIntelligence from '../../components/CustomerHistoryIntelligence'
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
  custom_client_name: '',
  contact_person: '', customer_email: '', customer_contact: '',
  save_as_client: true,
  quarry_id: '', preferred_vehicle_type_id: '',
  pickup_province: '', pickup_city: '', pickup_barangay: '', pickup_street: '', pickup_landmark: '',
  // Drop-off
  dropoff_province: '', dropoff_city: '', dropoff_barangay: '', dropoff_street: '', dropoff_landmark: '',
  // Material & load
  material_type_id: '', material_specification_id: '', load_volume_m3: '',
  // Schedule & instructions
  scheduled_start: '', scheduled_end: '',
  priority: 'normal', special_handling_instructions: '', notes: '',
}

function SectionHeading({ children, hint }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      borderBottom: '1px solid var(--border, #e5e7eb)',
      paddingBottom: 6, marginTop: 14, marginBottom: 2,
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
    }}>
      <span style={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
        {children}
      </span>
      {hint ? <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{hint}</span> : null}
    </div>
  )
}

function AutoFilledTag() {
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 600, color: '#0369a1', background: '#e0f2fe',
      borderRadius: 6, padding: '1px 6px', marginLeft: 6,
    }}>
      Auto-filled
    </span>
  )
}

function buildClientSelection(initial, clients) {
  if (!initial) return null
  if (initial.client_id) {
    const client = clients.find((c) => String(c.id) === String(initial.client_id))
    return {
      type: 'existing',
      clientId: initial.client_id,
      label: client?.client_name || initial.client?.client_name || `Client #${initial.client_id}`,
    }
  }
  const custom = initial.custom_client_name || initial.customer_name || buildDisplayName(initial)
  if (custom) return { type: 'custom', label: custom }
  return null
}

// ─── Job Order Form ───────────────────────────────────────────────────────────

function JobOrderForm({ initial, options, clientsLoading, onSaved, onCancel }) {
  const isEdit = Boolean(initial?.id)
  const clients = options.clients || []
  const materialTypes = useMemo(() => options.material_types || [], [options.material_types])
  const quarries = options.quarries || []
  const vehicleTypes = options.vehicle_types || []
  const findMaterialTypeById = (id) => materialTypes.find((m) => String(m.id) === String(id))
  const findClientById = (id) => clients.find((c) => String(c.id) === String(id))
  const findDefaultPreference = (clientId) => (options.client_preferences || []).find(
    (p) => String(p.client_id) === String(clientId) && p.is_default,
  )

  const initialMaterialTypeId = initial?.material_type_id ?? materialTypes.find((m) => m.name === initial?.material_type)?.id ?? ''
  const initialSpecs = findMaterialTypeById(initialMaterialTypeId)?.specifications ?? []
  const initialSpecificationId = initial?.material_specification_id
    ?? initialSpecs.find((s) => s.name === initial?.specification_size)?.id
    ?? ''

  const [form, setForm] = useState(initial ? {
    ...BLANK,
    client_id: initial.client_id ? String(initial.client_id) : '',
    custom_client_name: initial.custom_client_name ?? (initial.client_id ? '' : (initial.customer_name || buildDisplayName(initial) || '')),
    contact_person: initial.contact_person ?? initial.client?.contact_person ?? '',
    customer_email: initial.customer_email ?? initial.client?.email ?? '',
    customer_contact: initial.customer_contact ?? initial.client?.phone ?? '',
    save_as_client: !initial.client_id,
    quarry_id: initial.quarry_id ?? '',
    preferred_vehicle_type_id: initial.preferred_vehicle_type_id ?? '',
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
    material_type_id: initialMaterialTypeId,
    material_specification_id: initialSpecificationId,
    load_volume_m3: initial.load_volume_m3 ?? initial.volume_m3 ?? '',
    scheduled_start: initial.scheduled_start ? new Date(initial.scheduled_start).toISOString().slice(0, 16) : '',
    scheduled_end: initial.scheduled_end ? new Date(initial.scheduled_end).toISOString().slice(0, 16) : '',
    priority: initial.priority ?? 'normal',
    special_handling_instructions: initial.special_handling_instructions ?? initial.job_requirements ?? '',
    notes: initial.notes ?? '',
  } : BLANK)

  const [clientSelection, setClientSelection] = useState(() => buildClientSelection(initial, clients))
  const [autoFilled, setAutoFilled] = useState({})
  const [clientHistory, setClientHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const scheduleMin = minDatetimeLocalValue()
  const isCustomClient = !form.client_id && Boolean(form.custom_client_name?.trim())

  const specOptions = useMemo(() => {
    const selectedType = materialTypes.find((m) => String(m.id) === String(form.material_type_id))
    return selectedType?.specifications || []
  }, [materialTypes, form.material_type_id])

  const applyHistoryAutoFill = useCallback((autoFill) => {
    if (!autoFill || Object.keys(autoFill).length === 0) return

    const filled = {}
    const stringFields = [
      'quarry_id', 'preferred_vehicle_type_id', 'material_type_id', 'material_specification_id',
      'load_volume_m3', 'dropoff_province', 'dropoff_city', 'dropoff_barangay', 'dropoff_street', 'dropoff_landmark',
      'pickup_province', 'pickup_city', 'pickup_barangay', 'pickup_street', 'pickup_landmark',
    ]

    setForm((f) => {
      const next = { ...f }
      for (const key of stringFields) {
        if (autoFill[key] != null && autoFill[key] !== '') {
          next[key] = String(autoFill[key])
          filled[key] = true
        }
      }
      return next
    })
    setAutoFilled((prev) => ({ ...prev, ...filled }))
  }, [])

  useEffect(() => {
    if (!form.client_id) {
      setClientHistory(null)
      setHistoryError('')
      return undefined
    }

    let cancelled = false
    setHistoryLoading(true)
    setHistoryError('')

    const params = isEdit && initial?.id ? { exclude_job_order_id: initial.id } : {}

    fetchClientHistory(form.client_id, params)
      .then((history) => {
        if (cancelled) return
        setClientHistory(history)
        if (!isEdit) applyHistoryAutoFill(history?.auto_fill)
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err.message)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => { cancelled = true }
  }, [form.client_id, isEdit, initial?.id, applyHistoryAutoFill])

  useEffect(() => {
    if (!clients.length) return
    if (form.client_id) {
      const client = findClientById(form.client_id)
      if (client) {
        setClientSelection({ type: 'existing', clientId: client.id, label: client.client_name })
      }
    } else if (form.custom_client_name?.trim()) {
      setClientSelection({ type: 'custom', label: form.custom_client_name.trim() })
    }
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClientChange = useCallback((selection) => {
    setClientSelection(selection)
    const filled = {}

    if (selection?.type === 'existing') {
      const client = findClientById(selection.clientId)
      const pref = findDefaultPreference(selection.clientId)
      setForm((f) => ({
        ...f,
        client_id: String(selection.clientId),
        custom_client_name: '',
        save_as_client: false,
        contact_person: client?.contact_person || '',
        customer_email: client?.email || '',
        customer_contact: client?.phone || '',
        quarry_id: pref?.quarry_id ? String(pref.quarry_id) : f.quarry_id,
        preferred_vehicle_type_id: pref?.vehicle_type_id ? String(pref.vehicle_type_id) : f.preferred_vehicle_type_id,
      }))
      if (client) {
        filled.contact_person = Boolean(client.contact_person)
        filled.customer_email = Boolean(client.email)
        filled.customer_contact = Boolean(client.phone)
      }
      if (pref?.quarry_id) filled.quarry_id = true
      if (pref?.vehicle_type_id) filled.preferred_vehicle_type_id = true
      setAutoFilled(filled)
    } else if (selection?.type === 'custom') {
      setForm((f) => ({
        ...f,
        client_id: '',
        custom_client_name: selection.label,
        save_as_client: true,
      }))
      setAutoFilled({})
      setClientHistory(null)
      setHistoryError('')
    } else {
      setForm((f) => ({
        ...f,
        client_id: '',
        custom_client_name: '',
        save_as_client: true,
        contact_person: '',
        customer_email: '',
        customer_contact: '',
      }))
      setAutoFilled({})
      setClientHistory(null)
      setHistoryError('')
    }

    setFieldErrors((prev) => {
      if (!prev.client) return prev
      const next = { ...prev }
      delete next.client
      return next
    })
  }, [findClientById, findDefaultPreference])

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => {
      const next = { ...f, [k]: value }

      if (k === 'material_type_id') {
        next.material_specification_id = ''
      }
      return next
    })
    // Editing an auto-filled field clears its tag
    if (autoFilled[k]) setAutoFilled((p) => ({ ...p, [k]: false }))
    if (fieldErrors[k]) setFieldErrors((prev) => { const n = { ...prev }; delete n[k]; return n })
  }

  const buildPayload = () => {
    const selectedMaterial = materialTypes.find((m) => String(m.id) === String(form.material_type_id))
    const selectedSpecification = specOptions.find((s) => String(s.id) === String(form.material_specification_id))
    return {
      client_id: form.client_id ? Number(form.client_id) : null,
      custom_client_name: !form.client_id && form.custom_client_name?.trim() ? form.custom_client_name.trim() : null,
      contact_person: form.contact_person || null,
      customer_email: form.customer_email || null,
      customer_contact: form.customer_contact || null,
      save_as_client: isCustomClient ? Boolean(form.save_as_client) : false,
      quarry_id: form.quarry_id ? Number(form.quarry_id) : null,
      preferred_vehicle_type_id: form.preferred_vehicle_type_id ? Number(form.preferred_vehicle_type_id) : null,
      pickup_province: form.pickup_province || null,
      pickup_city: form.pickup_city || null,
      pickup_barangay: form.pickup_barangay || null,
      pickup_street: form.pickup_street || null,
      pickup_landmark: form.pickup_landmark || null,
      dropoff_province: form.dropoff_province || null,
      dropoff_city: form.dropoff_city || null,
      dropoff_barangay: form.dropoff_barangay || null,
      dropoff_street: form.dropoff_street || null,
      dropoff_landmark: form.dropoff_landmark || null,
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
      priority: form.priority,
    }
  }

  const validate = () => {
    const scheduleErrors = validateJobSchedule({ scheduled_start: form.scheduled_start, scheduled_end: form.scheduled_end })
    const errs = { ...scheduleErrors }

    if (!form.client_id && !form.custom_client_name?.trim()) {
      errs.client = 'Select an existing client or enter a custom client name.'
    }

    // Source: either a quarry or pickup details
    if (!form.quarry_id && !form.pickup_street && !form.pickup_city) {
      errs.pickup_street = 'Select a quarry/supplier or enter pickup source details.'
    }

    // Drop-off always required
    if (!form.dropoff_province) errs.dropoff_province = 'Drop-off province is required.'
    if (!form.dropoff_city) errs.dropoff_city = 'Drop-off city is required.'
    if (!form.dropoff_street) errs.dropoff_street = 'Drop-off street / site details are required.'

    if (!form.material_type_id) errs.material_type_id = 'Material type is required.'
    if (!form.material_specification_id) errs.material_specification_id = 'Specification / size is required.'
    if (form.load_volume_m3 === '' || Number.isNaN(Number(form.load_volume_m3))) {
      errs.load_volume_m3 = 'Load volume is required.'
    }
    if (!form.scheduled_start) errs.scheduled_start = 'Scheduled start is required.'
    return errs
  }

  const submit = async (proceedToBestFit) => {
    setSaving(true)
    setError('')
    setFieldErrors({})

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setError(firstScheduleError(errs) || 'Please complete all required fields.')
      setSaving(false)
      return
    }

    try {
      const payload = buildPayload()
      const saved = isEdit ? await updateJobOrder(initial.id, payload) : await createJobOrder(payload)
      onSaved(saved, isEdit, proceedToBestFit)
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
    <form className="dx-panel" style={{ marginTop: 20 }} onSubmit={(e) => { e.preventDefault(); submit(false) }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
        {isEdit ? `Edit Job Order — ${formatJobPublicId(initial.id)}` : 'Create Job Order'}
      </h3>

      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* ── Client ── */}
        <SectionHeading hint="Search existing clients or type a new company name">Client</SectionHeading>

        <label style={{ gridColumn: '1 / -1' }}>
          Client *
          <ClientCombobox
            clients={clients}
            value={clientSelection}
            onChange={handleClientChange}
            loading={clientsLoading}
            error={fieldErrors.client}
          />
          {fe('client')}
        </label>

        {form.client_id && (
          <CustomerHistoryIntelligence history={clientHistory} loading={historyLoading} error={historyError} />
        )}

        <label>
          Contact Person{autoFilled.contact_person && <AutoFilledTag />}
          <input value={form.contact_person} onChange={set('contact_person')} placeholder="Optional" />
        </label>
        <label>
          Email{autoFilled.customer_email && <AutoFilledTag />}
          <input type="email" value={form.customer_email} onChange={set('customer_email')} aria-invalid={fieldErrors.customer_email ? 'true' : undefined} />
          {fe('customer_email')}
        </label>
        <label>
          Contact Number{autoFilled.customer_contact && <AutoFilledTag />}
          <input value={form.customer_contact} onChange={set('customer_contact')} aria-invalid={fieldErrors.customer_contact ? 'true' : undefined} />
          {fe('customer_contact')}
        </label>

        {isCustomClient && (
          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.save_as_client} onChange={set('save_as_client')} style={{ width: 'auto' }} />
            Save this client to Master Data for future job orders
          </label>
        )}

        {/* ── Source / Pickup Details ── */}
        <SectionHeading hint="Auto-filled from customer order history">Source / Pickup Details</SectionHeading>
        <label>
          Quarry / Supplier{autoFilled.quarry_id && <AutoFilledTag />}
          <select name="quarry_id" value={form.quarry_id} onChange={set('quarry_id')}>
            <option value="">— Select quarry / supplier —</option>
            {quarries.map((q) => <option key={q.id} value={q.id}>{q.quarry_name}</option>)}
          </select>
        </label>
        <label>
          Preferred Vehicle Type{autoFilled.preferred_vehicle_type_id && <AutoFilledTag />}
          <select name="preferred_vehicle_type_id" value={form.preferred_vehicle_type_id} onChange={set('preferred_vehicle_type_id')}>
            <option value="">— Auto-determine by Best-Fit —</option>
            {vehicleTypes.map((vt) => <option key={vt.id} value={vt.id}>{vt.name}{vt.wheel_type ? ` (${vt.wheel_type})` : ''}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          Optionally specify a pickup source address if no quarry is selected:
        </label>
        <label>Province <input value={form.pickup_province} onChange={set('pickup_province')} placeholder="Optional if quarry chosen" /></label>
        <label>City / Municipality <input value={form.pickup_city} onChange={set('pickup_city')} placeholder="Optional if quarry chosen" /></label>
        <label>Barangay <input value={form.pickup_barangay} onChange={set('pickup_barangay')} placeholder="Optional" /></label>
        <label>Landmark <input value={form.pickup_landmark} onChange={set('pickup_landmark')} placeholder="Optional" /></label>
        <label style={{ gridColumn: '1 / -1' }}>
          Street / Lot / Building / Site Details
          <input value={form.pickup_street} onChange={set('pickup_street')} placeholder="Optional if quarry chosen" aria-invalid={fieldErrors.pickup_street ? 'true' : undefined} />
          {fe('pickup_street')}
        </label>

        {/* ── Section 4: Delivery Destination ── */}
        <SectionHeading>Delivery Destination</SectionHeading>
        <label>
          Province *{autoFilled.dropoff_province && <AutoFilledTag />}
          <input value={form.dropoff_province} onChange={set('dropoff_province')} aria-invalid={fieldErrors.dropoff_province ? 'true' : undefined} />
          {fe('dropoff_province')}
        </label>
        <label>
          City / Municipality *{autoFilled.dropoff_city && <AutoFilledTag />}
          <input value={form.dropoff_city} onChange={set('dropoff_city')} aria-invalid={fieldErrors.dropoff_city ? 'true' : undefined} />
          {fe('dropoff_city')}
        </label>
        <label>Barangay{autoFilled.dropoff_barangay && <AutoFilledTag />} <input value={form.dropoff_barangay} onChange={set('dropoff_barangay')} placeholder="Optional" /></label>
        <label>Landmark{autoFilled.dropoff_landmark && <AutoFilledTag />} <input value={form.dropoff_landmark} onChange={set('dropoff_landmark')} placeholder="Optional" /></label>
        <label style={{ gridColumn: '1 / -1' }}>
          Street / Lot / Building / Site Details *{autoFilled.dropoff_street && <AutoFilledTag />}
          <input value={form.dropoff_street} onChange={set('dropoff_street')} placeholder="e.g. Construction Site, EDSA cor. Shaw" aria-invalid={fieldErrors.dropoff_street ? 'true' : undefined} />
          {fe('dropoff_street')}
        </label>

        {/* ── Section 5: Material and Load ── */}
        <SectionHeading>Material and Load</SectionHeading>
        <label>
          Material Type *{autoFilled.material_type_id && <AutoFilledTag />}
          <select name="material_type_id" value={form.material_type_id} onChange={set('material_type_id')} aria-invalid={fieldErrors.material_type_id ? 'true' : undefined}>
            <option value="">— Select material type —</option>
            {materialTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {fe('material_type_id')}
        </label>
        <label>
          Specification / Size *{autoFilled.material_specification_id && <AutoFilledTag />}
          <select name="material_specification_id" value={form.material_specification_id} onChange={set('material_specification_id')} aria-invalid={fieldErrors.material_specification_id ? 'true' : undefined}>
            <option value="">— Select specification —</option>
            {specOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {fe('material_specification_id')}
        </label>
        <label>
          Load Volume (m³) *{autoFilled.load_volume_m3 && <AutoFilledTag />}
          <input type="number" step="0.001" min="0" value={form.load_volume_m3} onChange={set('load_volume_m3')} aria-invalid={fieldErrors.load_volume_m3 ? 'true' : undefined} />
          {fe('load_volume_m3')}
        </label>
        <div />

        {/* ── Section 6: Schedule and Instructions ── */}
        <SectionHeading>Schedule and Instructions</SectionHeading>
        <label>
          Scheduled Start *
          <input type="datetime-local" min={scheduleMin} value={form.scheduled_start} onChange={set('scheduled_start')} aria-invalid={fieldErrors.scheduled_start ? 'true' : undefined} />
          {fe('scheduled_start')}
        </label>
        <label>
          Scheduled End
          <input type="datetime-local" min={form.scheduled_start || scheduleMin} value={form.scheduled_end} onChange={set('scheduled_end')} aria-invalid={fieldErrors.scheduled_end ? 'true' : undefined} />
          {fe('scheduled_end')}
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
        <div />
        <label style={{ gridColumn: '1 / -1' }}>
          Special Handling Instructions
          <textarea rows="2" placeholder="Permits, handling, site access…" value={form.special_handling_instructions} onChange={set('special_handling_instructions')} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Notes
          <textarea rows="2" placeholder="Internal dispatcher notes…" value={form.notes} onChange={set('notes')} />
        </label>

        {/* ── Section 7: Submit ── */}
        {error && <p className="notice error" style={{ gridColumn: '1 / -1' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, gridColumn: '1 / -1', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-dx-secondary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create Job Order'}
          </button>
          {!isEdit && (
            <button type="button" className="btn-dx-primary" disabled={saving} onClick={() => submit(true)}>
              {saving ? 'Saving…' : 'Create and Proceed to Best-Fit'}
            </button>
          )}
          <button type="button" className="btn-dx-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CreateJobOrderPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [masterData, setMasterData] = useState({ clients: [], material_types: [], quarries: [], vehicle_types: [], client_preferences: [] })
  const [clientsLoading, setClientsLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [formMode, setFormMode] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setClientsLoading(true)
    try {
      const [jobsRes, optionsRes] = await Promise.all([fetchJobOrders(1), fetchMasterDataOptions()])
      setOrders(jobsRes.data || [])
      setMasterData({
        clients: optionsRes.clients || [],
        material_types: optionsRes.material_types || [],
        quarries: optionsRes.quarries || [],
        vehicle_types: optionsRes.vehicle_types || [],
        client_preferences: optionsRes.client_preferences || [],
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setClientsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleSaved = (saved, isEdit, proceedToBestFit) => {
    setFormMode(null)
    const savedOrder = saved?.data && typeof saved.data === 'object' ? saved.data : saved
    if (proceedToBestFit && savedOrder?.id) {
      navigate('/dispatcher/dispatch-best-fit', { state: { jobOrderId: savedOrder.id } })
      return
    }
    setMessage(`Job order ${isEdit ? 'updated' : 'created'}. Tracking code: ${savedOrder?.tracking_code ?? ''}`)
    setTimeout(() => setMessage(''), 5000)
    load()
    setSelected(savedOrder)
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
                    <td>{order.client?.client_name || order.custom_client_name || buildDisplayName(order)}</td>
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
                <div className="dx-kv"><span>Client</span><strong>{selected.client?.client_name || selected.custom_client_name || buildDisplayName(selected)}</strong></div>
                <div className="dx-kv"><span>Customer</span><strong>{buildDisplayName(selected) || '—'}</strong></div>
                <div className="dx-kv"><span>Contact</span><strong>{selected.customer_contact ?? selected.customer_email ?? '—'}</strong></div>
                <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                  <span>Pickup</span><strong style={{ textAlign: 'right' }}>{buildDisplayAddress('pickup', selected) || '—'}</strong>
                </div>
                <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                  <span>Drop-off</span><strong style={{ textAlign: 'right' }}>{buildDisplayAddress('dropoff', selected) || '—'}</strong>
                </div>
                {selected.material_type && (
                  <div className="dx-kv"><span>Material type</span><strong>{selected.material_type}</strong></div>
                )}
                <div className="dx-kv"><span>Quarry / Supplier</span><strong>{selected.quarry?.quarry_name || '—'}</strong></div>
                {selected.preferred_vehicle_type?.name && (
                  <div className="dx-kv"><span>Preferred vehicle</span><strong>{selected.preferred_vehicle_type.name}</strong></div>
                )}
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
                    <Link to="/dispatcher/dispatch-best-fit" state={{ jobOrderId: selected.id }} className="btn-dx-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
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
        <JobOrderForm initial={null} options={masterData} clientsLoading={clientsLoading} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
      )}
      {formMode?.order && (
        <JobOrderForm initial={formMode.order} options={masterData} clientsLoading={clientsLoading} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
      )}
    </section>
  )
}

export default CreateJobOrderPage
