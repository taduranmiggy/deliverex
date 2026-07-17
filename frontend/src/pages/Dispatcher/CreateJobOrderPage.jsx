import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  createJobOrder, createMaterialSpecification, createMaterialType,
  deleteJobOrder, fetchJobOrder, fetchJobOrders,
  fetchMasterDataOptions, updateJobOrder,
} from '../../api/dispatcher'
import CompanyCombobox from '../../components/CompanyCombobox'
import CreatableCombobox from '../../components/CreatableCombobox'
import { useToast } from '../../context/ToastContext'
import useConfirmation from '../../hooks/useConfirmation'
import { formatJobPublicId } from '../../utils/formatPhp'
import { formatJobStatus, jobStatusBadgeClass } from '../../utils/statusLabels'
import {
  formatScheduleReviewParts,
  minDatetimeLocalValue,
  minEndDatetimeLocalValue,
  toDatetimeLocalValue,
  validateJobSchedule,
} from '../../utils/scheduleValidation'
import { buildDisplayAddress, buildDisplayName } from '../../utils/jobOrderHelpers'
import {
  composeStructuredAddress,
  parseFullAddressToStructured,
  validateSimpleRouteStep,
} from '../../utils/jobOrderAddressValidation'
import { companyDropoffFields } from '../../utils/companyAddress'
import { formatJobSchedule } from '../../utils/driverAssignment'
import { Check, ChevronRight, FileText, Loader2, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { FilterSelect } from '../../components/ui'
import JobOrderRouteMap from '../../components/JobOrderRouteMap'

// ─── Constants ────────────────────────────────────────────────────────────────

const BLANK = {
  company_id: '', client_id: '',
  contact_person: '', customer_email: '', customer_contact: '',
  quarry_id: '', preferred_vehicle_type_id: '',
  pickup_location: '', dropoff_location: '',
  pickup_province: '', pickup_city: '', pickup_barangay: '', pickup_street: '', pickup_landmark: '',
  dropoff_province: '', dropoff_city: '', dropoff_barangay: '', dropoff_street: '', dropoff_landmark: '',
  material_type_id: '', material_specification_id: '', load_volume_m3: '',
  scheduled_start: '', scheduled_end: '',
  priority: 'normal', special_handling_instructions: '', notes: '',
  route_additional_details: '',
}

const STEPS = [
  { id: 1, label: 'Client Information', hint: 'Company & contacts' },
  { id: 2, label: 'Material Information', hint: 'Type, spec, vehicle & volume' },
  { id: 3, label: 'Route', hint: 'Pickup & delivery' },
  { id: 4, label: 'Schedule', hint: 'Start, end & priority' },
  { id: 5, label: 'Review & Confirm', hint: 'Check and submit' },
]

const DRAFT_KEY = 'dx_jo_wizard_draft'

/** Find the nearest scrollable ancestor (staff layout uses #main-content). */
function getScrollParent(el) {
  if (!el) return document.getElementById('main-content')
  let node = el.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node
    }
    node = node.parentElement
  }
  return document.getElementById('main-content')
}

/** Scroll the staff main pane so the job-order wizard is at the top. */
function scrollJobOrderFormIntoView(el, { behavior = 'smooth' } = {}) {
  if (!el) return

  const runScroll = () => {
    const scrollParent = getScrollParent(el)
    if (scrollParent) {
      const marginTop = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 16
      const top = el.getBoundingClientRect().top
        - scrollParent.getBoundingClientRect().top
        + scrollParent.scrollTop
        - marginTop
      scrollParent.scrollTo({ top: Math.max(0, top), behavior })
      return
    }
    el.scrollIntoView({ behavior, block: 'start' })
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(runScroll)
  })
}

// ─── Tab filter groups ─────────────────────────────────────────────────────────
const ACTIVE_STATUSES    = ['pending', 'assigned', 'in_progress', 'arrived']
const COMPLETED_STATUSES = ['completed']

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active Deliveries' },
  { id: 'completed', label: 'Completed' },
]

const STATUS_OPTIONS_ALL = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'pending',     label: 'Pending' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'in_progress', label: 'En Route' },
  { value: 'arrived',     label: 'Arrived' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]
const STATUS_OPTIONS_ACTIVE = [
  { value: 'all',         label: 'All Active' },
  { value: 'pending',     label: 'Pending' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'in_progress', label: 'En Route' },
  { value: 'arrived',     label: 'Arrived' },
]
const STATUS_OPTIONS_COMPLETED = [
  { value: 'all',       label: 'All Completed' },
  { value: 'completed', label: 'Completed' },
]

const PAGE_SIZE = 6

// ─── Helper builders ──────────────────────────────────────────────────────────

function buildMaterialTypeSelection(initial, materialTypes) {
  if (!initial?.material_type_id) return null
  const mt = materialTypes.find((m) => String(m.id) === String(initial.material_type_id))
  return { type: 'existing', id: initial.material_type_id, label: mt?.name || initial.material_type || `Material #${initial.material_type_id}` }
}

function buildSpecSelection(initial, specOptions) {
  if (!initial?.material_specification_id) return null
  const spec = specOptions.find((s) => String(s.id) === String(initial.material_specification_id))
  return { type: 'existing', id: initial.material_specification_id, label: spec?.name || initial.specification_size || `Spec #${initial.material_specification_id}` }
}

function buildClientSelection(initial, clients) {
  if (!initial) return null
  const companyId = initial.company_id ?? initial.client_id
  if (companyId) {
    const client = clients.find((c) => String(c.id) === String(companyId))
    const label = client?.company_name || client?.client_name || initial.company?.company_name || initial.client?.client_name || `Company #${companyId}`
    return { type: 'existing', clientId: companyId, companyId, label }
  }
  const custom = initial.custom_client_name || initial.customer_name || buildDisplayName(initial)
  if (custom) return { type: 'custom', label: custom }
  return null
}

// ─── Micro components ─────────────────────────────────────────────────────────

function AutoFilledTag() {
  return <span className="dx-autofill-tag">Auto-filled</span>
}

function WizLabel({ children, required }) {
  return (
    <span className="dx-wiz-label-text">
      {children}
      {required && <span className="dx-wiz-required">*</span>}
    </span>
  )
}

function FieldWrap({ label, required, error, full, children, style }) {
  return (
    <label className={`dx-wiz-label${full ? ' dx-wiz-full' : ''}`} style={style}>
      <WizLabel required={required}>{label}</WizLabel>
      {children}
      {error && <span className="dx-wiz-error-text">{error}</span>}
    </label>
  )
}

function WizInput({ value, onChange, placeholder, type = 'text', min, step, error, ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      step={step}
      className={`dx-wiz-input${error ? ' dx-wiz-input--error' : ''}`}
      {...rest}
    />
  )
}

function WizTextarea({ value, onChange, placeholder, rows = 3, error, ...rest }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={`dx-wiz-input${error ? ' dx-wiz-input--error' : ''}`}
      style={{ resize: 'vertical', minHeight: 72 }}
      {...rest}
    />
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="dx-stepper" role="list" aria-label="Form progress">
      {STEPS.map((step, i) => {
        const done   = step.id < current
        const active = step.id === current
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flex: step.id < STEPS.length ? 1 : 0 }}>
            <div
              className={`dx-stepper__step${done ? ' done' : ''}${active ? ' active' : ''}`}
              role="listitem"
              aria-current={active ? 'step' : undefined}
            >
              <div className="dx-stepper__dot">
                {done ? <Check size={13} /> : step.id}
              </div>
              <div className="dx-stepper__info">
                <span className="dx-stepper__label">{step.label}</span>
                <span className="dx-stepper__hint">{step.hint}</span>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`dx-stepper__connector${done ? ' done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Review Section ───────────────────────────────────────────────────────────

function ReviewBlock({ title, onEdit, stepNum, children, cols = 2 }) {
  return (
    <div className="dx-review-block">
      <div className="dx-review-block__header">
        <span className="dx-review-block__title">{title}</span>
        <button type="button" className="dx-review-block__edit" onClick={() => onEdit(stepNum)}>
          Edit
        </button>
      </div>
      <div className={`dx-review-block__body${cols === 1 ? ' dx-review-block__body--1col' : cols === 3 ? ' dx-review-block__body--3col' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function RR({ label, value }) {
  return (
    <div className="dx-review-row">
      <span className="dx-review-row__label">{label}</span>
      <span className={`dx-review-row__value${!value ? ' dx-review-row__empty' : ''}`}>{value || 'Not provided'}</span>
    </div>
  )
}

function ScheduleReviewRows({ start, end }) {
  const parts = formatScheduleReviewParts(start, end)
  if (!parts?.start && !parts?.end) {
    return <RR label="Schedule" value={null} />
  }

  return (
    <>
      {parts.start && (
        <div className="dx-review-row">
          <span className="dx-review-row__label">Start</span>
          <span className="dx-review-row__value" style={{ display: 'grid', gap: 2 }}>
            <span>{parts.start.date}</span>
            <span style={{ color: 'var(--muted)', fontSize: '0.875rem', fontWeight: 500 }}>{parts.start.time}</span>
          </span>
        </div>
      )}
      {parts.end && (
        <div className="dx-review-row">
          <span className="dx-review-row__label">End</span>
          <span className="dx-review-row__value" style={{ display: 'grid', gap: 2 }}>
            <span>{parts.end.date}</span>
            <span style={{ color: 'var(--muted)', fontSize: '0.875rem', fontWeight: 500 }}>{parts.end.time}</span>
          </span>
        </div>
      )}
    </>
  )
}

// ─── Job Order Wizard Form ─────────────────────────────────────────────────────

const JobOrderForm = forwardRef(function JobOrderForm(
  { initial, options, pickupLocationOptions, clientsLoading, onSaved, onCancel, onRefreshOptions },
  ref,
) {
  const isEdit       = Boolean(initial?.id)
  const clients      = options.companies || options.clients || []
  const materialTypes = useMemo(() => options.material_types || [], [options.material_types])
  const vehicleTypes = options.vehicle_types || []
  const quarries     = options.quarries        || []
  const toast        = useToast()
  const pickupLocationItems = useMemo(() => {
    const map = new Map()
    ;(pickupLocationOptions || []).forEach((item, idx) => {
      const name = (item?.name || '').trim()
      if (!name) return
      if (!map.has(name.toLowerCase())) map.set(name.toLowerCase(), { id: item.id || `opt-${idx}`, name })
    })
    quarries.forEach((q) => {
      const name = (q.quarry_name || '').trim()
      if (!name) return
      if (!map.has(name.toLowerCase())) map.set(name.toLowerCase(), { id: `quarry-${q.id}`, name })
    })
    return Array.from(map.values())
  }, [pickupLocationOptions, quarries])

  const findClientById       = (id) => clients.find((c) => String(c.id) === String(id))
  const findDefaultPreference = (clientId) => (options.client_preferences || []).find(
    (p) => String(p.client_id) === String(clientId) && p.is_default,
  )

  // ── Init from initial data or draft ────────────────────────────────────────
  const initialMaterialTypeId    = initial?.material_type_id ?? materialTypes.find((m) => m.name === initial?.material_type)?.id ?? ''
  const initialSpecs             = materialTypes.find((m) => String(m.id) === String(initialMaterialTypeId))?.specifications ?? []
  const initialSpecificationId   = initial?.material_specification_id ?? initialSpecs.find((s) => s.name === initial?.specification_size)?.id ?? ''

  const buildInitialForm = () => {
    if (!initial) {
      // Try to restore new-order draft from sessionStorage
      if (!isEdit) {
        try {
          const raw = sessionStorage.getItem(DRAFT_KEY)
          if (raw) {
            const draft = JSON.parse(raw)
            return { ...BLANK, ...draft }
          }
        } catch { /* ignore */ }
      }
      return BLANK
    }
    const pickupFromInitial = initial.pickup_location ?? buildDisplayAddress('pickup', initial) ?? ''
    const quarryIdStr = initial.quarry_id ? String(initial.quarry_id) : ''
    const quarryPickupFallback = !pickupFromInitial.trim() && quarryIdStr
      ? (initial.quarry?.quarry_name || quarries.find((q) => String(q.id) === quarryIdStr)?.quarry_name || '')
      : ''

    return {
      ...BLANK,
      company_id: initial.company_id ?? initial.client_id ? String(initial.company_id ?? initial.client_id) : '',
      client_id: initial.company_id ?? initial.client_id ? String(initial.company_id ?? initial.client_id) : '',
      contact_person: initial.contact_person ?? initial.client?.contact_person ?? initial.company?.contact_person ?? '',
      customer_email: initial.customer_email ?? initial.client?.email ?? initial.company?.company_email ?? '',
      customer_contact: initial.customer_contact ?? initial.client?.phone ?? initial.company?.contact_number ?? '',
      quarry_id: quarryIdStr,
      preferred_vehicle_type_id: initial.preferred_vehicle_type_id ?? '',
      pickup_location: pickupFromInitial || quarryPickupFallback,
      dropoff_location: initial.dropoff_location ?? buildDisplayAddress('dropoff', initial) ?? '',
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
      material_type_id: String(initialMaterialTypeId),
      material_specification_id: String(initialSpecificationId),
      load_volume_m3: initial.load_volume_m3 ?? initial.volume_m3 ?? '',
      scheduled_start: toDatetimeLocalValue(initial.scheduled_start),
      scheduled_end: toDatetimeLocalValue(initial.scheduled_end),
      priority: initial.priority ?? 'normal',
      special_handling_instructions: '',
      route_additional_details: initial.special_handling_instructions
        ?? initial.job_requirements
        ?? [initial.pickup_landmark, initial.dropoff_landmark].filter(Boolean).join('\n'),
      notes: '',
    }
  }

  const [form, setForm]         = useState(buildInitialForm)
  const [currentStep, setStep]  = useState(1)
  const [fieldErrors, setFE]    = useState({})
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [hasDraft, setHasDraft] = useState(() => {
    if (isEdit) return false
    try { return Boolean(sessionStorage.getItem(DRAFT_KEY)) } catch { return false }
  })

  const [clientSelection, setClientSelection]               = useState(() => buildClientSelection(initial, clients))
  const [materialTypeSelection, setMaterialTypeSelection]   = useState(() => buildMaterialTypeSelection(initial, materialTypes))
  const [specSelection, setSpecSelection]                   = useState(() => buildSpecSelection(initial, initialSpecs))
  const [materialTypeSaving, setMaterialTypeSaving]         = useState(false)
  const [specSaving, setSpecSaving]                         = useState(false)
  const [materialTypeError, setMaterialTypeError]           = useState('')
  const [specError, setSpecError]                           = useState('')
  const [autoFilled, setAutoFilled]                         = useState({})
  const [pickupLocationSelection, setPickupLocationSelection] = useState(
    form.pickup_location ? { type: 'custom', label: form.pickup_location } : null,
  )
  const [showRouteDetails, setShowRouteDetails] = useState(
    () => Boolean(String(form.route_additional_details ?? '').trim()),
  )

  const pickupFromQuarry = Boolean(form.quarry_id)
  const scheduleMin = minDatetimeLocalValue()
  const scheduleEndMin = minEndDatetimeLocalValue(form.scheduled_start)

  const stepPanelRef  = useRef(null)
  // Tracks every field the dispatcher has manually typed into.
  const userEditedRef = useRef(new Set())

  useImperativeHandle(ref, () => stepPanelRef.current, [])

  useLayoutEffect(() => {
    scrollJobOrderFormIntoView(stepPanelRef.current)
  }, [initial?.id])

  // ── Draft auto-save ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit) return
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch { /* ignore */ }
  }, [form, isEdit])

  const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setHasDraft(false)
  }

  // ── Spec options ───────────────────────────────────────────────────────────
  const specOptions = useMemo(() => {
    const selected = materialTypes.find((m) => String(m.id) === String(form.material_type_id))
    return selected?.specifications || []
  }, [materialTypes, form.material_type_id])

  useEffect(() => {
    if (form.pickup_location) {
      setPickupLocationSelection({ type: 'custom', label: form.pickup_location })
    } else {
      setPickupLocationSelection(null)
    }
  }, [form.pickup_location])

  useEffect(() => {
    if (!clients.length) return
    if (form.client_id) {
      const client = findClientById(form.client_id)
      if (client) setClientSelection({ type: 'existing', clientId: client.id, label: client.client_name })
    } else if (form.custom_client_name?.trim()) {
      setClientSelection({ type: 'custom', label: form.custom_client_name.trim() })
    }
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!materialTypes.length) return
    if (form.material_type_id) {
      const mt = materialTypes.find((m) => String(m.id) === String(form.material_type_id))
      if (mt) setMaterialTypeSelection({ type: 'existing', id: mt.id, label: mt.name })
    }
    if (form.material_specification_id) {
      const spec = specOptions.find((s) => String(s.id) === String(form.material_specification_id))
      if (spec) setSpecSelection({ type: 'existing', id: spec.id, label: spec.name })
    }
  }, [materialTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Material type handler ──────────────────────────────────────────────────
  const handleMaterialTypeChange = useCallback(async (selection) => {
    setMaterialTypeError('')
    if (!selection) {
      setMaterialTypeSelection(null); setSpecSelection(null)
      setForm((f) => ({ ...f, material_type_id: '', material_specification_id: '' })); return
    }
    if (selection.type === 'existing') {
      setMaterialTypeSelection(selection); setSpecSelection(null)
      setForm((f) => ({ ...f, material_type_id: String(selection.id), material_specification_id: '' }))
      if (autoFilled.material_type_id) setAutoFilled((p) => ({ ...p, material_type_id: false, material_specification_id: false })); return
    }
    setMaterialTypeSaving(true)
    try {
      const res = await createMaterialType(selection.label)
      await onRefreshOptions?.()
      const mt = res.material_type
      setMaterialTypeSelection({ type: 'existing', id: mt.id, label: mt.name }); setSpecSelection(null)
      setForm((f) => ({ ...f, material_type_id: String(mt.id), material_specification_id: '' }))
      toast(`Material type "${mt.name}" saved.`, 'success', 3000)
    } catch (err) { setMaterialTypeError(err.message) } finally { setMaterialTypeSaving(false) }
  }, [autoFilled.material_type_id, onRefreshOptions, toast])

  // ── Spec handler ───────────────────────────────────────────────────────────
  const handleSpecChange = useCallback(async (selection) => {
    setSpecError('')
    if (!form.material_type_id) { setSpecError('Select a material type first.'); return }
    if (!selection) { setSpecSelection(null); setForm((f) => ({ ...f, material_specification_id: '' })); return }
    if (selection.type === 'existing') {
      setSpecSelection(selection)
      setForm((f) => ({ ...f, material_specification_id: String(selection.id) }))
      if (autoFilled.material_specification_id) setAutoFilled((p) => ({ ...p, material_specification_id: false })); return
    }
    setSpecSaving(true)
    try {
      const res = await createMaterialSpecification(Number(form.material_type_id), selection.label)
      await onRefreshOptions?.()
      const spec = res.material_specification
      setSpecSelection({ type: 'existing', id: spec.id, label: spec.name })
      setForm((f) => ({ ...f, material_specification_id: String(spec.id) }))
      toast(`Specification "${spec.name}" saved.`, 'success', 3000)
    } catch (err) { setSpecError(err.message) } finally { setSpecSaving(false) }
  }, [form.material_type_id, autoFilled.material_specification_id, onRefreshOptions, toast])

  // ── Client handler ─────────────────────────────────────────────────────────
  const handleClientChange = useCallback((selection) => {
    setClientSelection(selection)
    const filled = {}
    if (selection?.type === 'existing') {
      const id = selection.companyId ?? selection.clientId
      const client = findClientById(id)
      const pref   = findDefaultPreference(id)
      // Client changed — allow contact fields to be re-filled even if user
      // had previously edited them for a different client.
      userEditedRef.current.delete('contact_person')
      userEditedRef.current.delete('customer_email')
      userEditedRef.current.delete('customer_contact')
      userEditedRef.current.delete('dropoff_street')
      userEditedRef.current.delete('dropoff_barangay')
      userEditedRef.current.delete('dropoff_city')
      userEditedRef.current.delete('dropoff_province')
      userEditedRef.current.delete('dropoff_location')
      const prefQuarryId = pref?.quarry_id ? String(pref.quarry_id) : ''
      const prefQuarry = prefQuarryId ? quarries.find((q) => String(q.id) === prefQuarryId) : null
      const canAutoFillPickup = Boolean(prefQuarry) && !userEditedRef.current.has('pickup_location')
      const dropoffAutofill = companyDropoffFields(client)
      const canAutoFillDropoff = Boolean(dropoffAutofill)
      setForm((f) => {
        const next = {
          ...f,
          company_id: String(id), client_id: String(id),
          contact_person:   client?.contact_person || '',
          customer_email:   client?.company_email || client?.email || '',
          customer_contact: client?.contact_number || client?.phone || '',
          preferred_vehicle_type_id: pref?.vehicle_type_id ? String(pref.vehicle_type_id) : f.preferred_vehicle_type_id,
        }
        if (canAutoFillPickup) {
          next.quarry_id = prefQuarryId
          next.pickup_location = prefQuarry.quarry_name
          next.pickup_street = prefQuarry.quarry_name
        }
        if (canAutoFillDropoff) {
          Object.assign(next, dropoffAutofill)
        }
        return next
      })
      if (canAutoFillPickup) {
        setPickupLocationSelection({ type: 'existing', id: `quarry-${prefQuarryId}`, label: prefQuarry.quarry_name })
      }
      if (client) {
        filled.contact_person   = Boolean(client.contact_person)
        filled.customer_email   = Boolean(client.email)
        filled.customer_contact = Boolean(client.phone)
      }
      if (canAutoFillPickup) filled.pickup_location = true
      if (canAutoFillDropoff) {
        filled.dropoff_location = true
      }
      if (pref?.vehicle_type_id) filled.preferred_vehicle_type_id = true
      setAutoFilled(filled)
    } else {
      userEditedRef.current.clear()
      setForm((f) => ({ ...f, company_id: '', client_id: '', contact_person: '', customer_email: '', customer_contact: '' }))
      setAutoFilled({})
    }
    setFE((prev) => { if (!prev.client) return prev; const n = { ...prev }; delete n.client; return n })
  }, [findClientById, findDefaultPreference, quarries])

  const handlePickupLocationChange = useCallback((selection) => {
    setPickupLocationSelection(selection)
    userEditedRef.current.add('pickup_location')
    const quarryId =
      selection?.type === 'existing' && String(selection.id).startsWith('quarry-')
        ? String(selection.id).replace(/^quarry-/, '')
        : ''
    setForm((f) => ({
      ...f,
      pickup_location: selection?.label || '',
      pickup_street: selection?.label || '',
      quarry_id: quarryId,
    }))
    if (fieldErrors.pickup_location) {
      setFE((prev) => { const n = { ...prev }; delete n.pickup_location; return n })
    }
  }, [fieldErrors.pickup_location])

  // ── Field change ───────────────────────────────────────────────────────────
  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    // Mark this field as manually edited so async auto-fill cannot overwrite it
    userEditedRef.current.add(k)
    // Batch form + side-effect state into a single setForm call to avoid
    // a second state setter (setAutoFilled) triggering a separate re-render
    // cycle that can disturb focus on the currently typed-in input.
    setForm((f) => ({ ...f, [k]: value }))
    // Clear autofill badge and field error in separate updates; React 18
    // batches all setStates called synchronously in one event handler.
    if (autoFilled[k]) setAutoFilled((p) => ({ ...p, [k]: false }))
    if (fieldErrors[k]) setFE((prev) => { const n = { ...prev }; delete n[k]; return n })
  }

  // ── Per-step validation ────────────────────────────────────────────────────
  const validateStep = (step) => {
    const errs = {}
    if (step === 1) {
      if (!form.company_id && !form.client_id)
        errs.client = 'Select an active company.'
      if (!form.customer_email?.trim())
        errs.customer_email = 'Company email is required.'
    }
    if (step === 2) {
      if (!form.material_type_id && materialTypeSelection?.type !== 'custom')
        errs.material_type = 'Material type is required.'
      if (!form.material_specification_id && specSelection?.type !== 'custom')
        errs.material_specification = 'Specification / size is required.'
      if (!form.preferred_vehicle_type_id)
        errs.preferred_vehicle_type_id = 'Vehicle type is required for dispatch.'
      if (form.load_volume_m3 === '' || Number.isNaN(Number(form.load_volume_m3)))
        errs.load_volume_m3 = 'Load volume is required.'
    }
    if (step === 3) {
      Object.assign(errs, validateSimpleRouteStep(form, { pickupFromQuarry }))
    }
    if (step === 4) {
      const schedErrs = validateJobSchedule(
        { scheduled_start: form.scheduled_start, scheduled_end: form.scheduled_end },
        { requireBoth: true },
      )
      Object.assign(errs, schedErrs)
    }
    setFE(errs)
    return Object.keys(errs).length === 0
  }

  const goNext = () => {
    if (validateStep(currentStep)) {
      setError('')
      setStep((s) => Math.min(s + 1, 5))
      scrollJobOrderFormIntoView(stepPanelRef.current)
    } else {
      scrollJobOrderFormIntoView(stepPanelRef.current)
    }
  }

  const goBack = () => {
    setFE({}); setError('')
    setStep((s) => Math.max(s - 1, 1))
    scrollJobOrderFormIntoView(stepPanelRef.current)
  }

  const goToStep = (n) => { setFE({}); setError(''); setStep(n) }

  // ── Final payload + submit ─────────────────────────────────────────────────
  const buildPayload = () => {
    const pickupLine = String(form.pickup_location ?? '').trim()
      || composeStructuredAddress('pickup', form)
    const destinationLine = String(form.dropoff_location ?? '').trim()
      || composeStructuredAddress('dropoff', form)
    const pickupParsed = pickupFromQuarry ? null : parseFullAddressToStructured(pickupLine)
    const dropParsed = parseFullAddressToStructured(destinationLine)
    const routeDetails = String(form.route_additional_details ?? '').trim()

    return {
    company_id:               form.company_id || form.client_id ? Number(form.company_id || form.client_id) : null,
    client_id:                form.company_id || form.client_id ? Number(form.company_id || form.client_id) : null,
    contact_person:           form.contact_person || null,
    customer_email:           form.customer_email || null,
    customer_contact:         form.customer_contact || null,
    quarry_id:                form.quarry_id ? Number(form.quarry_id) : null,
    preferred_vehicle_type_id: form.preferred_vehicle_type_id ? Number(form.preferred_vehicle_type_id) : null,
    pickup_location:          pickupLine || null,
    dropoff_location:         destinationLine || null,
    pickup_province:          pickupFromQuarry ? null : (pickupParsed?.province || null),
    pickup_city:              pickupFromQuarry ? null : (pickupParsed?.city || null),
    pickup_barangay:          pickupFromQuarry ? null : (pickupParsed?.barangay || null),
    pickup_street:            pickupFromQuarry ? (pickupLine || null) : (pickupParsed?.street || null),
    pickup_landmark:          null,
    dropoff_province:         dropParsed.province || null,
    dropoff_city:             dropParsed.city || null,
    dropoff_barangay:         dropParsed.barangay || null,
    dropoff_street:           dropParsed.street || null,
    dropoff_landmark:         null,
    material_type_id:         form.material_type_id ? Number(form.material_type_id) : null,
    material_specification_id: form.material_specification_id ? Number(form.material_specification_id) : null,
    custom_material_type_name: !form.material_type_id && materialTypeSelection?.type === 'custom' ? materialTypeSelection.label : null,
    custom_specification_name: !form.material_specification_id && specSelection?.type === 'custom' ? specSelection.label : null,
    material_type:            materialTypeSelection?.label ?? null,
    specification_size:       specSelection?.label ?? null,
    load_volume_m3:           form.load_volume_m3 !== '' ? Number(form.load_volume_m3) : null,
    volume_m3:                form.load_volume_m3 !== '' ? Number(form.load_volume_m3) : null,
    special_handling_instructions: routeDetails || null,
    job_requirements:         null,
    scheduled_start:          form.scheduled_start || null,
    scheduled_end:            form.scheduled_end || null,
    priority:                 form.priority,
  }
  }

  const submit = async () => {
    // Final guard — run all step validations
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setError('Some required fields are incomplete. Please review each step.')
        goToStep(s)
        scrollJobOrderFormIntoView(stepPanelRef.current)
        return
      }
    }
    setSaving(true); setError('')
    try {
      const payload = buildPayload()
      const saved = isEdit ? await updateJobOrder(initial.id, payload) : await createJobOrder(payload)
      clearDraft()
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err.message)
      scrollJobOrderFormIntoView(stepPanelRef.current)
    } finally {
      setSaving(false)
    }
  }

  // ── Lookup helpers for review ──────────────────────────────────────────────
  const pickupAddr = form.pickup_location || buildDisplayAddress('pickup', form)
  const dropAddr   = form.dropoff_location || buildDisplayAddress('dropoff', form)
  const clientLabel = clientSelection?.label || '—'

  // ─ PRIORITY label
  const PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
  const vehicleTypeLabel = vehicleTypes.find((v) => String(v.id) === String(form.preferred_vehicle_type_id))?.name

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      id="job-order-form"
      className="dx-panel dx-job-order-wizard"
      style={{ padding: '22px 24px', marginTop: 16 }}
      ref={stepPanelRef}
    >

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            {isEdit ? `Edit Job Order — ${formatJobPublicId(initial.id)}` : 'New Job Order'}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Step {currentStep} of {STEPS.length} — {STEPS[currentStep - 1].hint}
          </p>
        </div>
        <button type="button" onClick={() => { clearDraft(); onCancel() }}
          style={{ border: 'none', background: 'none', fontSize: '1.375rem', color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, lineHeight: 1 }}>
          ×
        </button>
      </div>

      {/* Draft banner */}
      {hasDraft && !isEdit && (
        <div className="dx-draft-banner">
          <RotateCcw size={14} />
          Draft restored from your last session.
          <button type="button" onClick={() => { setForm(BLANK); setClientSelection(null); setMaterialTypeSelection(null); setSpecSelection(null); clearDraft() }}>
            Start fresh
          </button>
        </div>
      )}

      {/* Stepper */}
      <StepIndicator current={currentStep} />

      {/* ── Step panels ── */}
      <div key={currentStep} className="dx-wizard-step">

        {/* ── STEP 1: Client Information ── */}
        {currentStep === 1 && (
          <>
            <p className="dx-wizard-step-title">Client Information</p>
            <p className="dx-wizard-step-subtitle">Select the B2B company for this delivery. Contact details are filled from the company record.</p>

            <div className="dx-wiz-grid" style={{ marginBottom: 14 }}>
              <FieldWrap label={<>Company {autoFilled.client_id && <AutoFilledTag />}</>} required full error={fieldErrors.client}>
                <CompanyCombobox
                  companies={clients}
                  value={clientSelection}
                  onChange={handleClientChange}
                  loading={clientsLoading}
                  error={fieldErrors.client}
                />
              </FieldWrap>

              <FieldWrap label={<>Contact Person {autoFilled.contact_person && <AutoFilledTag />}</>}>
                <WizInput value={form.contact_person} onChange={set('contact_person')} placeholder="From company record" />
              </FieldWrap>

              <FieldWrap label={<>Contact Number {autoFilled.customer_contact && <AutoFilledTag />}</>} error={fieldErrors.customer_contact}>
                <WizInput
                  type="text"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.customer_contact}
                  onChange={set('customer_contact')}
                  placeholder="From company record"
                  error={fieldErrors.customer_contact}
                />
              </FieldWrap>

              <FieldWrap label={<>Email {autoFilled.customer_email && <AutoFilledTag />}</>} required error={fieldErrors.customer_email}>
                <WizInput
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={form.customer_email}
                  onChange={set('customer_email')}
                  placeholder="From company record"
                  error={fieldErrors.customer_email}
                />
              </FieldWrap>
            </div>
          </>
        )}

        {/* ── STEP 2: Material & Load ── */}
        {currentStep === 2 && (
          <>
            <p className="dx-wizard-step-title">Material Information</p>
            <p className="dx-wizard-step-subtitle">What material is being delivered, which vehicle type should be matched, and how much volume is required?</p>

            <div className="dx-wiz-grid" style={{ marginBottom: 14 }}>
              <FieldWrap
                label={<>Material Type {autoFilled.material_type_id && <AutoFilledTag />}</>}
                required error={fieldErrors.material_type || materialTypeError}
              >
                <CreatableCombobox
                  items={materialTypes}
                  getItemLabel={(item) => item.name}
                  value={materialTypeSelection}
                  onChange={handleMaterialTypeChange}
                  loading={clientsLoading}
                  saving={materialTypeSaving}
                  error={fieldErrors.material_type || materialTypeError || null}
                  placeholder="Search or type new material…"
                  customOptionLabel={(q) => `Add: ${q}`}
                  emptyMessage="No material types yet."
                />
              </FieldWrap>

              <FieldWrap
                label={<>Specification / Size {autoFilled.material_specification_id && <AutoFilledTag />}</>}
                required error={fieldErrors.material_specification || specError}
              >
                <CreatableCombobox
                  items={specOptions}
                  getItemLabel={(item) => item.name}
                  value={specSelection}
                  onChange={handleSpecChange}
                  saving={specSaving}
                  disabled={!form.material_type_id}
                  error={fieldErrors.material_specification || specError || null}
                  placeholder={form.material_type_id ? 'Search or type new spec…' : 'Pick material first'}
                  customOptionLabel={(q) => `Add: ${q}`}
                  emptyMessage="No specs for this material."
                />
              </FieldWrap>

              <FieldWrap label={<>Vehicle Type {autoFilled.preferred_vehicle_type_id && <AutoFilledTag />}</>} required error={fieldErrors.preferred_vehicle_type_id}>
                <select value={form.preferred_vehicle_type_id} onChange={set('preferred_vehicle_type_id')} className={`dx-wiz-input${fieldErrors.preferred_vehicle_type_id ? ' dx-wiz-input--error' : ''}`} style={{ cursor: 'pointer' }}>
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((vt) => (
                    <option key={vt.id} value={vt.id}>
                      {vt.name}{vt.wheel_type ? ` (${vt.wheel_type})` : ''}
                    </option>
                  ))}
                </select>
              </FieldWrap>

              <FieldWrap label="Volume (m³)" required error={fieldErrors.load_volume_m3}>
                <WizInput
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  autoComplete="off"
                  value={form.load_volume_m3}
                  onChange={set('load_volume_m3')}
                  placeholder="e.g. 12.5"
                  error={fieldErrors.load_volume_m3}
                />
              </FieldWrap>
            </div>
          </>
        )}

        {/* ── STEP 3: Route ── */}
        {currentStep === 3 && (
          <>
            <p className="dx-wizard-step-title">Route</p>
            <p className="dx-wizard-step-subtitle">
              Enter pickup and destination addresses. Use the full address in each field.
            </p>

            <div className="dx-wiz-grid" style={{ marginBottom: 16 }}>
              <FieldWrap label={<>Pickup Location {autoFilled.pickup_location && <AutoFilledTag />}</>} required error={fieldErrors.pickup_location} full>
                <CreatableCombobox
                  items={pickupLocationItems}
                  getItemId={(item) => item.id}
                  getItemLabel={(item) => item.name}
                  value={pickupLocationSelection}
                  onChange={handlePickupLocationChange}
                  error={fieldErrors.pickup_location || null}
                  placeholder="Search quarry, supplier, or enter pickup address…"
                  customOptionLabel={(q) => `Use custom pickup: ${q}`}
                  emptyMessage="No saved pickup locations."
                />
              </FieldWrap>

              <FieldWrap label={<>Destination {autoFilled.dropoff_location && <AutoFilledTag />}</>} required error={fieldErrors.dropoff_location} full>
                <WizTextarea
                  value={form.dropoff_location}
                  onChange={set('dropoff_location')}
                  placeholder="e.g. #43 Ninang Lydia St., B.F. Homes Phase 1, Caloocan City"
                  error={fieldErrors.dropoff_location}
                  rows={2}
                />
              </FieldWrap>
            </div>

            {!showRouteDetails ? (
              <button
                type="button"
                className="btn-dx-secondary btn-sm"
                style={{ marginBottom: 4 }}
                onClick={() => setShowRouteDetails(true)}
              >
                + Add details (optional)
              </button>
            ) : (
              <FieldWrap label="Additional Details (Optional)" full>
                <WizTextarea
                  value={form.route_additional_details}
                  onChange={set('route_additional_details')}
                  placeholder="Landmarks, gate instructions, loading notes, contact instructions, special handling…"
                  rows={3}
                />
              </FieldWrap>
            )}
          </>
        )}

        {/* ── STEP 4: Schedule ── */}
        {currentStep === 4 && (
          <>
            <p className="dx-wizard-step-title">Schedule</p>
            <p className="dx-wizard-step-subtitle">
              Set the delivery start and end time, then choose how urgent it is.
            </p>

            <div className="dx-wiz-grid" style={{ marginBottom: 16 }}>
              <FieldWrap label="Start Date & Time" required error={fieldErrors.scheduled_start}>
                <WizInput
                  type="datetime-local"
                  min={scheduleMin}
                  value={form.scheduled_start}
                  onChange={set('scheduled_start')}
                  error={fieldErrors.scheduled_start}
                />
              </FieldWrap>
              <FieldWrap label="End Date & Time" required error={fieldErrors.scheduled_end}>
                <WizInput
                  type="datetime-local"
                  min={scheduleEndMin}
                  value={form.scheduled_end}
                  onChange={set('scheduled_end')}
                  error={fieldErrors.scheduled_end}
                />
              </FieldWrap>
              <FieldWrap label="Priority">
                <select value={form.priority} onChange={set('priority')} className="dx-wiz-input" style={{ cursor: 'pointer' }}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </FieldWrap>
            </div>
          </>
        )}

        {/* ── STEP 5: Review ── */}
        {currentStep === 5 && (
          <>
            <p className="dx-wizard-step-title">Review &amp; Confirm</p>
            <p className="dx-wizard-step-subtitle">Everything looks good? Review the details below before creating the job order.</p>

            <ReviewBlock title="Client Information" onEdit={goToStep} stepNum={1}>
              <RR label="Company"        value={clientLabel} />
              <RR label="Contact Person" value={form.contact_person} />
              <RR label="Contact Number" value={form.customer_contact} />
              <RR label="Email"          value={form.customer_email} />
            </ReviewBlock>

            <ReviewBlock title="Material Information" onEdit={goToStep} stepNum={2} cols={3}>
              <RR label="Material Type"    value={materialTypeSelection?.label} />
              <RR label="Specification"    value={specSelection?.label} />
              <RR label="Vehicle Type"     value={vehicleTypeLabel} />
              <RR label="Volume"           value={form.load_volume_m3 ? `${form.load_volume_m3} m³` : null} />
            </ReviewBlock>

            <ReviewBlock title="Route" onEdit={goToStep} stepNum={3} cols={2}>
              <RR label="Pickup Location" value={pickupAddr} />
              <RR label="Destination" value={dropAddr} />
              {form.route_additional_details?.trim() ? (
                <RR label="Additional Details" value={form.route_additional_details} />
              ) : null}
            </ReviewBlock>

            <ReviewBlock title="Schedule" onEdit={goToStep} stepNum={4} cols={2}>
              <ScheduleReviewRows start={form.scheduled_start} end={form.scheduled_end} />
              <RR label="Priority" value={PRIORITY_LABELS[form.priority] ?? form.priority} />
            </ReviewBlock>

            {error && <p className="notice error" style={{ marginTop: 6 }}>{error}</p>}
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="dx-wizard-nav">
        {currentStep > 1 && (
          <button type="button" className="btn-dx-secondary" onClick={goBack} disabled={saving}>
            ← Back
          </button>
        )}

        <span className="dx-wizard-nav__step-label">
          {currentStep < 5 && `Step ${currentStep} of ${STEPS.length}`}
        </span>

        <div className="dx-wizard-nav__spacer" />

        {currentStep < 4 && (
          <button type="button" className="btn-dx-primary" onClick={goNext}>
            Next <ChevronRight size={15} style={{ marginLeft: 2 }} />
          </button>
        )}

        {currentStep === 4 && (
          <button type="button" className="btn-dx-primary" onClick={goNext}>
            Review Order <ChevronRight size={15} style={{ marginLeft: 2 }} />
          </button>
        )}

        {currentStep === 5 && (
          <button type="button" className="btn-dx-primary" disabled={saving} onClick={() => submit()}>
            {saving
              ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
              : <><FileText size={14} /> {isEdit ? 'Save Changes' : 'Create Job Order'}</>}
          </button>
        )}
      </div>
    </div>
  )
})

// ─── Page ─────────────────────────────────────────────────────────────────────

function CreateJobOrderPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()
  const [orders, setOrders]         = useState([])
  const [masterData, setMasterData] = useState({ clients: [], material_types: [], quarries: [], vehicle_types: [], client_preferences: [], pickup_locations: [] })
  const [clientsLoading, setClientsLoading] = useState(true)
  const [selected, setSelected]     = useState(null)
  const [formMode, setFormMode]     = useState(null)
  const formPanelRef                = useRef(null)
  const [error, setError]           = useState('')
  // Allow dashboard KPI cards to pre-select a tab via navigation state
  const [activeTab, setActiveTab]   = useState(location.state?.initialTab || 'active')
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage]             = useState(1)
  const { requestConfirmation, confirmationModal } = useConfirmation()

  const load = useCallback(async () => {
    setClientsLoading(true)
    try {
      const [jobsRes, optionsRes] = await Promise.all([fetchJobOrders(1), fetchMasterDataOptions()])
      setOrders(jobsRes.data || [])
      setMasterData({
        clients:            optionsRes.clients            || [],
        material_types:     optionsRes.material_types     || [],
        quarries:           optionsRes.quarries           || [],
        vehicle_types:      optionsRes.vehicle_types      || [],
        client_preferences: optionsRes.client_preferences || [],
        pickup_locations:   Array.from(new Set(
          (jobsRes.data || [])
            .map((j) => (j.pickup_location || buildDisplayAddress('pickup', j) || '').trim())
            .filter(Boolean),
        )).map((name, idx) => ({ id: `pickup-${idx}-${name}`, name })),
      })
    } catch (err) { setError(err.message) }
    finally { setClientsLoading(false) }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  const refreshOptions = useCallback(async () => {
    const optionsRes = await fetchMasterDataOptions()
    setMasterData((prev) => ({ ...prev, material_types: optionsRes.material_types || [] }))
  }, [])

  // ── Tab counts ────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:       orders.length,
    active:    orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    completed: orders.filter((o) => COMPLETED_STATUSES.includes(o.status)).length,
  }), [orders])

  // ── Status options scoped to current tab ─────────────────────────────────
  const statusOptions = useMemo(() => {
    if (activeTab === 'active')    return STATUS_OPTIONS_ACTIVE
    if (activeTab === 'completed') return STATUS_OPTIONS_COMPLETED
    return STATUS_OPTIONS_ALL
  }, [activeTab])

  // ── Filtered + searched rows ───────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let list = orders
    if (activeTab === 'active')    list = list.filter((o) => ACTIVE_STATUSES.includes(o.status))
    if (activeTab === 'completed') list = list.filter((o) => COMPLETED_STATUSES.includes(o.status))
    if (statusFilter !== 'all')    list = list.filter((o) => o.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((o) => {
        const clientName = (o.client?.client_name || o.custom_client_name || buildDisplayName(o) || '').toLowerCase()
        const trackCode  = (o.tracking_code || '').toLowerCase()
        const jobId      = formatJobPublicId(o.id).toLowerCase()
        const material   = (o.material_type || '').toLowerCase()
        const dropoff    = buildDisplayAddress('dropoff', o).toLowerCase()
        const pickupSource = (o.quarry?.quarry_name || '').toLowerCase()
        const driver     = (o.assignments?.[0]?.driver?.user?.name || '').toLowerCase()
        return clientName.includes(q) || trackCode.includes(q) || jobId.includes(q)
          || material.includes(q) || dropoff.includes(q) || pickupSource.includes(q) || driver.includes(q)
      })
    }
    return list
  }, [orders, activeTab, search, statusFilter])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const pagedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOrders, page],
  )

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [activeTab, search, statusFilter])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearch('')
    setStatusFilter('all')
    setPage(1)
    // Deselect if the current selection is no longer in the new tab's results
    if (selected) {
      const inTab = tab === 'all'       ? true
        : tab === 'active'    ? ACTIVE_STATUSES.includes(selected.status)
        : tab === 'completed' ? COMPLETED_STATUSES.includes(selected.status)
        : true
      if (!inTab) setSelected(null)
    }
  }

  const handleSaved = (saved, isEdit) => {
    setFormMode(null)
    refreshOptions().catch(() => {})
    const savedOrder = saved?.data && typeof saved.data === 'object' ? saved.data : saved
    const trackingCode = savedOrder?.tracking_code ?? ''
    toast(
      `Job order ${isEdit ? 'updated' : 'created'} successfully.${trackingCode ? ` Tracking code: ${trackingCode}` : ''}`,
      'success',
    )
    load()
    setSelected(savedOrder)
  }

  const handleDelete = (order) => {
    const publicId = formatJobPublicId(order.id)
    requestConfirmation({
      title: 'Delete Job Order',
      message: `Are you sure you want to delete job order ${publicId}?`,
      detail: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setError('')
        try {
          await deleteJobOrder(order.id)
          toast(`Job order ${publicId} deleted.`, 'warning')
          setSelected(null)
          load()
        } catch (err) {
          toast(err.message || 'Failed to delete job order.', 'error')
          throw err
        }
      },
    })
  }

  const firstAssignment = selected?.assignments?.[0]
  const isCreating = formMode === 'create'
  const isEditing  = Boolean(formMode?.order)
  const formOpen   = isCreating || isEditing
  const formScrollKey = isEditing ? `edit-${formMode.order.id}` : isCreating ? 'create' : null

  useLayoutEffect(() => {
    if (!formOpen) return
    scrollJobOrderFormIntoView(formPanelRef.current)
  }, [formOpen, formScrollKey])

  return (
    <section>
      <header className="page-header">
        <div className="header-stack">
          <h1>Job Orders</h1>
          <p>Create, manage, and dispatch job orders to the fleet</p>
        </div>
        <button
          className={isCreating ? 'btn-dx-secondary' : 'btn-dx-primary'}
          type="button"
          style={{ height: 'fit-content', alignSelf: 'center' }}
          onClick={() => {
            if (isCreating) { setFormMode(null) } else { setFormMode('create'); setSelected(null) }
          }}
        >
          {isCreating ? '✕ Cancel New Order' : '+ New Job Order'}
        </button>
      </header>

      {error && <p className="notice error" style={{ marginBottom: 12 }}>{error}</p>}

      {/* ── Wizard form — slides in above the table ── */}
      {formOpen && (
        <JobOrderForm
          ref={formPanelRef}
          key={isEditing ? `edit-${formMode.order.id}` : 'create'}
          initial={isEditing ? formMode.order : null}
          options={masterData}
          pickupLocationOptions={masterData.pickup_locations || []}
          clientsLoading={clientsLoading}
          onRefreshOptions={refreshOptions}
          onSaved={handleSaved}
          onCancel={() => setFormMode(null)}
        />
      )}

      <div className="dx-split-bestfit" style={{ gridTemplateColumns: '1fr 360px', gap: 20, marginTop: 16 }}>
        <div className="dx-panel" style={{ marginBottom: 0 }}>

          {/* ── Tab pills ── */}
          <div className="dx-filter-bar">
            <div className="dx-filter-tabs" role="tablist" aria-label="Filter job orders">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`dx-filter-tab${activeTab === tab.id ? ' dx-filter-tab--active' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                  <span className="dx-filter-tab__badge">{counts[tab.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Toolbar: search + status + refresh + count ── */}
          <div className="dx-filter-toolbar">
            <div className="dx-filter-search" role="search" aria-label="Search job orders">
              <span className="dx-filter-search__icon" aria-hidden>
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search ID, client, material, pickup, driver..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search within filtered orders"
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  className="dx-filter-search__clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <FilterSelect
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              label="Status"
              options={statusOptions}
              style={{ flexShrink: 0 }}
            />

            <button
              type="button"
              className="btn-dx-secondary"
              onClick={load}
              disabled={clientsLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <RefreshCw size={13} style={clientsLoading ? { animation: 'spin 0.8s linear infinite' } : {}} />
              {clientsLoading ? 'Loading…' : 'Refresh'}
            </button>

            <span className="dx-filter-count">
              {filteredOrders.length}{filteredOrders.length !== counts[activeTab] ? ` of ${counts[activeTab]}` : ''} {activeTab === 'active' ? 'active' : activeTab === 'completed' ? 'completed' : 'total'}
            </span>
          </div>

          {/* ── Table ── */}
          <div className="dx-data-table-wrap" style={{ overflowY: 'auto', maxHeight: 500 }}>
            <table className="dx-data-table">
              <thead>
                <tr>
                  <th>Job ID</th><th>Client</th><th>Route</th><th>Priority</th>
                  <th>Schedule</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clientsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j}><div style={{ height: 14, borderRadius: 6, background: 'var(--slate-200)', width: j === 0 ? '70%' : '55%', animation: 'shimmer 1.4s infinite' }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                    {orders.length === 0
                      ? <>No job orders yet.{' '}
                          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}
                            onClick={() => setFormMode('create')}>Create the first one →</button>
                        </>
                      : (search || statusFilter !== 'all')
                        ? `No results match your filter in ${TABS.find(t => t.id === activeTab)?.label}.`
                        : `No ${activeTab === 'active' ? 'active deliveries' : activeTab === 'completed' ? 'completed orders' : 'orders'} found.`
                    }
                  </td></tr>
                ) : (
                  pagedOrders.map((order) => (
                    <tr key={order.id} role="button" tabIndex={0}
                      onClick={() => { setSelected(order); setFormMode(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(order); setFormMode(null) } }}
                      className={selected?.id === order.id ? 'is-selected' : undefined}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><span className="job-link">{formatJobPublicId(order.id)}</span></td>
                      <td style={{ fontWeight: 500 }}>{order.client?.client_name || order.custom_client_name || buildDisplayName(order)}</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                        {buildDisplayAddress('pickup', order)} → {buildDisplayAddress('dropoff', order)}
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{order.priority}</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {formatJobSchedule(order)}
                      </td>
                      <td><span className={jobStatusBadgeClass(order.status)}>{formatJobStatus(order.status)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="dx-pager">
              <button type="button" className="dx-pager__btn" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
              <span className="dx-pager__info">Page {page} of {totalPages}</span>
              <button type="button" className="dx-pager__btn" disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
            </div>
          )}
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
                <div className="dx-kv"><span>Contact</span><strong>{selected.customer_contact ?? selected.customer_email ?? '—'}</strong></div>
                <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                  <span>Pickup</span><strong style={{ textAlign: 'right' }}>{buildDisplayAddress('pickup', selected) || '—'}</strong>
                </div>
                <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                  <span>Destination</span><strong style={{ textAlign: 'right' }}>{buildDisplayAddress('dropoff', selected) || '—'}</strong>
                </div>
                <JobOrderRouteMap key={selected.id} jobOrderId={selected.id} variant="detail" readOnly />
                {selected.material_type && (
                  <div className="dx-kv"><span>Material</span><strong>{selected.material_type}{selected.specification_size ? ` · ${selected.specification_size}` : ''}</strong></div>
                )}
                <div className="dx-kv"><span>Load</span>
                  <strong>{selected.load_volume_m3 || selected.volume_m3 ? `${selected.load_volume_m3 ?? selected.volume_m3} m³` : '—'}</strong>
                </div>
                <div className="dx-kv"><span>Schedule</span>
                  <strong>{formatJobSchedule(selected)}</strong>
                </div>
                <div className="dx-kv"><span>Priority</span><strong style={{ textTransform: 'capitalize' }}>{selected.priority}</strong></div>
                <div style={{ marginBottom: 4 }}><span className={jobStatusBadgeClass(selected.status)}>{formatJobStatus(selected.status)}</span></div>
                <div className="dx-kv"><span>Tracking</span><strong style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{selected.tracking_code}</strong></div>
                <div className="dx-kv"><span>Driver</span><strong>{firstAssignment?.driver?.user?.name ?? '—'}</strong></div>
                <div className="dx-kv"><span>Vehicle</span><strong>{firstAssignment?.vehicle?.plate_no ?? '—'}</strong></div>
                {selected.job_requirements && (
                  <div className="dx-kv" style={{ alignItems: 'flex-start' }}>
                    <span>Handling</span><strong>{selected.job_requirements}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-dx-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={async () => {
                      try {
                        const full = await fetchJobOrder(selected.id)
                        const fullOrder = full?.data && typeof full.data === 'object' ? full.data : full
                        setFormMode({ order: fullOrder || selected })
                      } catch {
                        // Fallback to the selected row payload if detail fetch fails.
                        setFormMode({ order: selected })
                      }
                    }}
                  >
                    Edit
                  </button>
                  {selected.status === 'pending' && (
                    <Link to="/dispatcher/dispatch" state={{ jobOrderId: selected.id }} className="btn-dx-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                      ⚡ Dispatch
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
      {confirmationModal}
    </section>
  )
}

export default CreateJobOrderPage
