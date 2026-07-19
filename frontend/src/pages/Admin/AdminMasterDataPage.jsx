import { useCallback, useEffect, useMemo, useState } from 'react'
import { archiveMasterDataRecord, createMasterDataRecord, fetchMasterData, generateAllDriverAccounts, generateDriverAccount, updateMasterDataRecord } from '../../api/admin'
import { DataTable, EmptyState, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import useConfirmation from '../../hooks/useConfirmation'
import { ChevronRight, Database, Link2, Plus, RefreshCw, UserPlus } from 'lucide-react'
import PsgcAddressSelector from '../../components/PsgcAddressSelector'
import { fromPsgcAddress, toPsgcAddress } from '../../utils/psgcAddress'

// ─── Tab config ────────────────────────────────────────────────────────────────
// material-specifications is kept for modal reference but NOT in the visible tab strip.
const TAB_CONFIG = {
  'material-types':             { label: 'Materials',       title: 'Material Types',              headers: ['Name', 'Specs', 'Status', 'Actions'] },
  'material-specifications':    { label: 'Specifications',  title: 'Material Specifications',     headers: ['Material Type', 'Specification', 'Status', 'Actions'] },
  clients:                      { label: 'Clients',         title: 'Clients',                     headers: ['Client', 'Contact', 'Email', 'Status', 'Actions'] },
  quarries:                     { label: 'Quarries',        title: 'Quarries / Suppliers',        headers: ['Quarry', 'Contact', 'Email', 'Status', 'Actions'] },
  'vehicle-types':              { label: 'Vehicle Types',   title: 'Vehicle Types',               headers: ['Name', 'Wheel Type', 'CBM Range', 'Status', 'Actions'] },
  vehicles:                     { label: 'Vehicles',        title: 'Vehicles',                    headers: ['Plate', 'Type', 'CBM', 'Status', 'Actions'] },
  drivers:                      { label: 'Drivers',         title: 'Drivers',                     headers: ['Name', 'License', 'Linked Account', 'Link Status', 'Actions'] },
  'driver-vehicle-assignments':  { label: 'Driver-Vehicle', title: 'Driver-Vehicle Assignments',  headers: ['Driver', 'Vehicle', 'Primary', 'Status', 'Actions'] },
}

// Tabs shown in the UI strip — material-specifications is merged into material-types
const UI_TABS = Object.keys(TAB_CONFIG).filter((k) => k !== 'material-specifications' && k !== 'clients')

// ─── Helpers ────────────────────────────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  return (
    <label>
      Status
      <select value={value || 'active'} onChange={onChange}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </label>
  )
}

function buildInitialForm(tab, item) {
  const base = { status: item?.status || 'active' }
  if (tab === 'material-types') return { ...base, name: item?.name || '' }
  if (tab === 'material-specifications') return { ...base, material_type_id: item?.material_type_id || '', name: item?.name || '' }
  if (tab === 'clients') return { ...base, client_name: item?.client_name || '', contact_person: item?.contact_person || '', email: item?.email || '', phone: item?.phone || '' }
  if (tab === 'quarries') return { ...base, quarry_name: item?.quarry_name || '', contact_person: item?.contact_person || '', email: item?.email || '', phone: item?.phone || '' }
  if (tab === 'vehicle-types') return { ...base, name: item?.name || '', wheel_type: item?.wheel_type || '', min_cbm: item?.min_cbm || '', max_cbm: item?.max_cbm || '' }
  if (tab === 'vehicles') return { ...base, plate_no: item?.plate_no || '', vehicle_type_id: item?.vehicle_type_id || '', length_cm: item?.length_cm || '', width_cm: item?.width_cm || '', height_cm: item?.height_cm || '', cbm_capacity: item?.cbm_capacity || '' }
  if (tab === 'drivers') return {
    ...base, full_name: item?.full_name || '', license_no: item?.license_no || '',
    license_expiry: item?.license_expiry || '', availability: item?.availability || 'available',
    ...fromPsgcAddress(toPsgcAddress(item || {})), address: item?.address || '',
  }
  if (tab === 'driver-vehicle-assignments') return { ...base, driver_id: item?.driver_id || '', vehicle_id: item?.vehicle_id || '', is_primary: String(Boolean(item?.is_primary)) }
  return { ...base, client_id: item?.client_id || '', quarry_id: item?.quarry_id || '', vehicle_type_id: item?.vehicle_type_id || '', is_default: String(item?.is_default ?? true) }
}

function sanitizePayload(tab, form) {
  const p = { ...form }
  const num = ['material_type_id', 'vehicle_type_id', 'driver_id', 'vehicle_id', 'client_id', 'quarry_id']
  num.forEach((k) => { if (p[k] === '') p[k] = null; else if (p[k] != null) p[k] = Number(p[k]) })
  if (p.min_cbm === '') p.min_cbm = null
  if (p.max_cbm === '') p.max_cbm = null
  if (p.length_cm === '') p.length_cm = null
  if (p.width_cm === '') p.width_cm = null
  if (p.height_cm === '') p.height_cm = null
  if (p.cbm_capacity === '') p.cbm_capacity = null
  if (p.license_no === '') p.license_no = null
  if (p.license_expiry === '') p.license_expiry = null
  if (tab === 'drivers' && !p.address_region_code) {
    Object.keys(p).forEach((key) => {
      if (key === 'address' || key.startsWith('address_')) delete p[key]
    })
  }
  if (p.is_primary != null) p.is_primary = p.is_primary === true || p.is_primary === 'true'
  if (p.is_default != null) p.is_default = p.is_default === true || p.is_default === 'true'
  if (tab === 'vehicles') p.plate_no = String(p.plate_no || '').trim().toUpperCase()
  return p
}

function validatePositiveVehicleFields(form) {
  const fields = [
    ['length_cm', 'Length'],
    ['width_cm', 'Width'],
    ['height_cm', 'Height'],
    ['cbm_capacity', 'CBM capacity'],
  ]

  for (const [key, label] of fields) {
    const value = form?.[key]
    if (value === '' || value == null) continue
    const num = Number(value)
    if (!Number.isFinite(num)) {
      return `${label} must be a valid number.`
    }
    if (num <= 0) {
      return `${label} must be greater than zero.`
    }
  }

  return ''
}

function rowMatches(row, tab, search) {
  const q = String(search || '').toLowerCase()
  if (!q) return true
  const hay = []
  if (tab === 'clients') hay.push(row.client_name, row.email, row.phone)
  if (tab === 'quarries') hay.push(row.quarry_name, row.email, row.phone)
  if (tab === 'vehicle-types') hay.push(row.name, row.wheel_type)
  if (tab === 'vehicles') hay.push(row.plate_no, row.type, row.vehicleType?.name)
  if (tab === 'drivers') hay.push(row.full_name, row.license_no, row.user?.name)
  if (tab === 'driver-vehicle-assignments') hay.push(row.driver?.full_name, row.vehicle?.plate_no)
  return hay.some((v) => String(v || '').toLowerCase().includes(q))
}

// ─── Record modal ───────────────────────────────────────────────────────────────
// modal = { item, tab }  — tab is explicit, decoupled from the page tab state
function MasterRecordModal({ tab, item, data, onClose, onSaved }) {
  const isEdit = Boolean(item?.id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => buildInitialForm(tab, item))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setPositive = (k) => (e) => {
    const next = e.target.value
    if (next.startsWith('-')) return
    setForm((f) => ({ ...f, [k]: next }))
  }
  const blockNegativeKey = (e) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
      e.preventDefault()
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (tab === 'vehicles') {
      const msg = validatePositiveVehicleFields(form)
      if (msg) {
        setError(msg)
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      const payload = sanitizePayload(tab, form)
      if (isEdit) await updateMasterDataRecord(tab, item.id, payload)
      else await createMasterDataRecord(tab, payload)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const mt      = data.material_types || []
  const vt      = data.vehicle_types  || []
  const drivers  = data.drivers       || []
  const vehicles = data.vehicles      || []

  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="dx-modal-header">
          <h2>{isEdit ? `Edit ${TAB_CONFIG[tab].title}` : `Add ${TAB_CONFIG[tab].title}`}</h2>
          <button type="button" className="dx-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="form-grid" style={{ padding: '20px 28px 28px', gridTemplateColumns: '1fr 1fr' }} onSubmit={submit}>
          {tab === 'material-types' && (
            <>
              <label style={{ gridColumn: '1/-1' }}>Name <input required value={form.name} onChange={set('name')} /></label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {tab === 'material-specifications' && (
            <>
              <label>
                Material type
                <select required value={form.material_type_id} onChange={set('material_type_id')}>
                  <option value="">— Select —</option>
                  {mt.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <StatusSelect value={form.status} onChange={set('status')} />
              <label style={{ gridColumn: '1/-1' }}>Specification <input required value={form.name} onChange={set('name')} /></label>
            </>
          )}
          {tab === 'clients' && (
            <>
              <label style={{ gridColumn: '1/-1' }}>Client name <input required value={form.client_name} onChange={set('client_name')} /></label>
              <label>Contact person <input value={form.contact_person} onChange={set('contact_person')} /></label>
              <label>Email <input type="email" value={form.email} onChange={set('email')} /></label>
              <label>Phone <input value={form.phone} onChange={set('phone')} /></label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {tab === 'quarries' && (
            <>
              <label style={{ gridColumn: '1/-1' }}>Quarry name <input required value={form.quarry_name} onChange={set('quarry_name')} /></label>
              <label>Contact person <input value={form.contact_person} onChange={set('contact_person')} /></label>
              <label>Email <input type="email" value={form.email} onChange={set('email')} /></label>
              <label>Phone <input value={form.phone} onChange={set('phone')} /></label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {tab === 'vehicle-types' && (
            <>
              <label>Name <input required value={form.name} onChange={set('name')} /></label>
              <label>Wheel type <input value={form.wheel_type} onChange={set('wheel_type')} /></label>
              <label>Min CBM <input type="number" step="0.001" value={form.min_cbm} onChange={set('min_cbm')} /></label>
              <label>Max CBM <input type="number" step="0.001" value={form.max_cbm} onChange={set('max_cbm')} /></label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {tab === 'vehicles' && (
            <>
              <label>Plate no <input required value={form.plate_no} onChange={set('plate_no')} /></label>
              <label>
                Vehicle type
                <select value={form.vehicle_type_id} onChange={set('vehicle_type_id')}>
                  <option value="">— Select —</option>
                  {vt.map((r) => <option key={r.id} value={r.id}>{r.name} {r.wheel_type ? `(${r.wheel_type})` : ''}</option>)}
                </select>
              </label>
              <label>Length (cm) <input type="number" min="0.01" step="0.01" value={form.length_cm} onChange={setPositive('length_cm')} onKeyDown={blockNegativeKey} /></label>
              <label>Width (cm) <input type="number" min="0.01" step="0.01" value={form.width_cm} onChange={setPositive('width_cm')} onKeyDown={blockNegativeKey} /></label>
              <label>Height (cm) <input type="number" min="0.01" step="0.01" value={form.height_cm} onChange={setPositive('height_cm')} onKeyDown={blockNegativeKey} /></label>
              <label>CBM capacity <input type="number" min="0.001" step="0.001" value={form.cbm_capacity} onChange={setPositive('cbm_capacity')} onKeyDown={blockNegativeKey} /></label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {tab === 'drivers' && (
            <>
              <label style={{ gridColumn: '1/-1' }}>Full name <input required value={form.full_name} onChange={set('full_name')} /></label>
              <label>License no <input value={form.license_no} onChange={set('license_no')} /></label>
              <label>License expiry <input type="date" value={form.license_expiry} onChange={set('license_expiry')} /></label>
              <PsgcAddressSelector
                title="Driver address"
                value={toPsgcAddress(form)}
                onChange={(address) => setForm((current) => ({ ...current, ...fromPsgcAddress(address) }))}
                required={!isEdit || Boolean(form.address_region_code)}
                legacyAddress={form.address || ''}
              />
              <label>Availability
                <select value={form.availability} onChange={set('availability')}>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {tab === 'driver-vehicle-assignments' && (
            <>
              <label>
                Driver
                <select required value={form.driver_id} onChange={set('driver_id')}>
                  <option value="">— Select —</option>
                  {drivers.map((r) => <option key={r.id} value={r.id}>{r.full_name || r.user?.name}</option>)}
                </select>
              </label>
              <label>
                Vehicle
                <select required value={form.vehicle_id} onChange={set('vehicle_id')}>
                  <option value="">— Select —</option>
                  {vehicles.map((r) => <option key={r.id} value={r.id}>{r.plate_no}</option>)}
                </select>
              </label>
              <label>
                Is primary
                <select value={form.is_primary} onChange={set('is_primary')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <StatusSelect value={form.status} onChange={set('status')} />
            </>
          )}
          {error && <p className="notice error" style={{ margin: 0, gridColumn: '1/-1' }}>{error}</p>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}</button>
            <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Materials accordion ────────────────────────────────────────────────────────
function MaterialsAccordion({ materials, specsGrouped, search, page, perPage, onEditMaterial, onArchiveMaterial, onAddSpec, onEditSpec, onArchiveSpec }) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  const toggle = (id) => setExpandedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // Auto-expand materials whose spec name matches the search query
  useEffect(() => {
    if (!search) return
    const q = search.trim().toLowerCase()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      materials.forEach((mt) => {
        const specs = specsGrouped[mt.id] || []
        if (specs.some((s) => s.name.toLowerCase().includes(q))) next.add(mt.id)
      })
      return next
    })
  }, [search, materials, specsGrouped])

  // Filter: material matches by name OR any of its specs match
  const q = search.trim().toLowerCase()
  const filtered = q
    ? materials.filter((mt) => {
        const specs = specsGrouped[mt.id] || []
        return mt.name.toLowerCase().includes(q) || specs.some((s) => s.name.toLowerCase().includes(q))
      })
    : materials

  // Paginate the filtered list
  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  if (filtered.length === 0) {
    return (
      <div className="dx-accordion-table">
        <div className="dx-accordion-norows">
          {q ? `No materials or specifications match "${search}".` : 'No material types yet.'}
        </div>
      </div>
    )
  }

  return (
    <div className="dx-accordion-table">
      {/* Column headers */}
      <div className="dx-accordion-head">
        <span>Material Type</span>
        <span style={{ textAlign: 'center' }}>Specs</span>
        <span>Status</span>
        <span>Actions</span>
      </div>

      {paged.map((mt) => {
        const isOpen    = expandedIds.has(mt.id)
        const allSpecs  = specsGrouped[mt.id] || []
        const specs     = q
          ? allSpecs.filter((s) => s.name.toLowerCase().includes(q) || mt.name.toLowerCase().includes(q))
          : allSpecs

        return (
          <div key={mt.id} className="dx-accordion-item">
            {/* ── Material row ── */}
            <div className={`dx-accordion-row${isOpen ? ' dx-accordion-row--open' : ''}`}>
              <button
                type="button"
                className="dx-accordion-toggle"
                onClick={() => toggle(mt.id)}
                aria-expanded={isOpen}
              >
                <ChevronRight
                  size={16}
                  className={`dx-accordion-chevron${isOpen ? ' dx-accordion-chevron--open' : ''}`}
                  aria-hidden
                />
                {mt.name}
              </button>

              <span className="dx-spec-count">
                {allSpecs.length} spec{allSpecs.length !== 1 ? 's' : ''}
              </span>

              <StatusBadge status={mt.status} />

              <div className="dx-text-actions">
                <button type="button" onClick={() => onEditMaterial(mt)}>Edit</button>
                <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => onArchiveMaterial(mt)}>Archive</button>
              </div>
            </div>

            {/* ── Expanded specs ── */}
            {isOpen && (
              <div className="dx-accordion-specs">
                {specs.length === 0 ? (
                  <div className="dx-accordion-empty">No specifications for this material yet.</div>
                ) : (
                  specs.map((spec) => (
                    <div key={spec.id} className="dx-accordion-spec-row">
                      <span className="dx-spec-bullet" aria-hidden>•</span>
                      <span className="dx-spec-name">{spec.name}</span>
                      <StatusBadge status={spec.status} />
                      <div className="dx-text-actions">
                        <button type="button" onClick={() => onEditSpec(spec)}>Edit</button>
                        <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => onArchiveSpec(spec)}>Archive</button>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  className="dx-accordion-add-spec"
                  onClick={() => onAddSpec(mt.id)}
                >
                  <Plus size={13} /> Add Specification
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────
const DEFAULT_PER_PAGE = 6

function AdminMasterDataPage() {
  const [tab, setTab]       = useState('material-types')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [msg, setMsg]       = useState('')
  // modal = { item, tab } — tab is decoupled from page tab so accordion can open spec modals
  const [modal, setModal]   = useState(null)
  // Pagination
  const [page, setPage]     = useState(1)
  const [perPage] = useState(DEFAULT_PER_PAGE)
  const [data, setData]     = useState({
    material_types: [], material_specifications: [],
    clients: [], quarries: [], vehicle_types: [],
    vehicles: [], drivers: [], driver_vehicle_assignments: [],
  })
  // Driver account generation
  const [generatingId, setGeneratingId]   = useState(null) // per-row spinner
  const [generatingAll, setGeneratingAll] = useState(false)
  const [genResult, setGenResult]         = useState(null)  // bulk result summary
  const [credentialModal, setCredentialModal] = useState(null)
  const { requestConfirmation, confirmationModal } = useConfirmation()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res     = await fetchMasterData()
      const payload = res?.data && typeof res.data === 'object' ? res.data : res
      setData({
        material_types:             payload?.material_types             || [],
        material_specifications:    payload?.material_specifications    || [],
        clients:                    payload?.clients                    || [],
        quarries:                   payload?.quarries                   || [],
        vehicle_types:              payload?.vehicle_types              || [],
        vehicles:                   payload?.vehicles                   || [],
        drivers:                    payload?.drivers                    || [],
        driver_vehicle_assignments: payload?.driver_vehicle_assignments || [],
      })
    } catch (err) {
      setError(err?.message || 'Unable to load master data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  // ── Specs grouped by material_type_id ──────────────────────────────────
  const specsGrouped = useMemo(() => {
    const map = {}
    data.material_specifications.forEach((spec) => {
      const id = spec.material_type_id
      if (!map[id]) map[id] = []
      map[id].push(spec)
    })
    return map
  }, [data.material_specifications])

  // ── Rows for non-material tabs ─────────────────────────────────────────
  const tabRows = useMemo(() => {
    if (tab === 'material-types') return [] // handled by accordion
    const map = {
      clients: data.clients, quarries: data.quarries,
      'vehicle-types': data.vehicle_types, vehicles: data.vehicles,
      drivers: data.drivers, 'driver-vehicle-assignments': data.driver_vehicle_assignments,
    }
    return (map[tab] || []).filter((row) => rowMatches(row, tab, search))
  }, [data, tab, search])

  // ── Pagination — reset to page 1 when tab or search changes ───────────
  useEffect(() => { setPage(1) }, [tab, search, perPage])

  // For non-material tabs: paginate tabRows
  const pagedRows    = useMemo(() => tabRows.slice((page - 1) * perPage, page * perPage), [tabRows, page, perPage])

  // For materials tab: filtered count (used by PaginationBar)
  const matQ           = search.trim().toLowerCase()
  const filteredMatsTotal = useMemo(() => {
    if (tab !== 'material-types') return 0
    if (!matQ) return data.material_types.length
    return data.material_types.filter((mt) => {
      const specs = specsGrouped[mt.id] || []
      return mt.name.toLowerCase().includes(matQ) || specs.some((s) => s.name.toLowerCase().includes(matQ))
    }).length
  }, [tab, data.material_types, specsGrouped, matQ])

  const paginationTotal = tab === 'material-types' ? filteredMatsTotal : tabRows.length

  const flash = (text, ms = 5000) => { setMsg(text); setTimeout(() => setMsg(''), ms) }

  const onGenerateAccount = async (driverId) => {
    setGeneratingId(driverId)
    setError('')
    try {
      const res = await generateDriverAccount(driverId)
      if (res.created && res.email && (res.temporary_password || res.default_password)) {
        setCredentialModal({
          email: res.email,
          password: res.temporary_password || res.default_password,
          driverName: res.driver?.full_name || res.driver?.user?.name || 'Driver',
        })
      } else {
        flash(res.message || 'Account linked.')
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingId(null)
    }
  }

  const onGenerateAll = () => {
    requestConfirmation({
      title: 'Generate Driver Accounts',
      message: 'Generate login accounts for all unlinked drivers?',
      detail: 'Each new account gets a unique temporary password (DRV-XXXXXX).',
      confirmLabel: 'Generate Accounts',
      variant: 'warning',
      onConfirm: async () => {
        setGeneratingAll(true)
        setError('')
        setGenResult(null)
        try {
          const res = await generateAllDriverAccounts()
          setGenResult(res)
          flash(res.message || 'Done.')
          load()
        } catch (err) {
          setError(err.message)
          throw err
        } finally {
          setGeneratingAll(false)
        }
      },
    })
  }

  // archive accepts an explicit tabKey so accordion spec rows can archive correctly
  const onArchive = (item, tabKey = tab) => {
    const recordTitle = TAB_CONFIG[tabKey].title
    requestConfirmation({
      title: `Archive ${recordTitle}`,
      message: `Are you sure you want to archive this ${recordTitle.toLowerCase()} record?`,
      detail: 'Archived records can still be restored later.',
      confirmLabel: 'Archive',
      variant: 'archive',
      onConfirm: async () => {
        try {
          await archiveMasterDataRecord(tabKey, item.id)
          flash('Record archived.')
          load()
        } catch (err) {
          setError(err.message)
          throw err
        }
      },
    })
  }

  // ── Add button label ───────────────────────────────────────────────────
  // On the Materials tab we only add Material Types from the header button.
  // Specs are added inline via the accordion.
  const addLabel = tab === 'material-types'
    ? 'Add Material Type'
    : `Add ${TAB_CONFIG[tab]?.title.replace(/s$/, '')}`

  return (
    <>
      <PageHeader title="Master Data" subtitle="Operational materials, suppliers, fleet, and drivers. B2B companies are managed under Company Management.">
        {tab === 'drivers' && (
          <button
            className="btn-dx-secondary"
            type="button"
            disabled={generatingAll}
            onClick={onGenerateAll}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {generatingAll
              ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><UserPlus size={15} /> Generate All Accounts</>
            }
          </button>
        )}
        <button
          className="btn-dx-primary"
          type="button"
          onClick={() => setModal({ item: null, tab })}
        >
          <Plus size={16} /> {addLabel}
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}
      {genResult && (
        <div className="notice" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <strong>Bulk account generation complete:</strong>
          <span>{genResult.processed} drivers processed</span>
          <span style={{ color: '#16a34a' }}>{genResult.created} accounts created</span>
          <span style={{ color: '#2563eb' }}>{genResult.reused} existing accounts reused</span>
          {(genResult.accounts || []).filter((a) => a.created).length > 0 && (
            <div style={{ width: '100%', marginTop: 4 }}>
              <strong style={{ fontSize: '0.8125rem' }}>New accounts (share temporary passwords securely):</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: '0.8125rem' }}>
                {(genResult.accounts || []).filter((a) => a.created).map((a) => (
                  <li key={a.driver_id}>
                    {a.driver_name} — {a.email}
                    {(a.temporary_password || a.default_password) ? ` · ${a.temporary_password || a.default_password}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6 }} onClick={() => setGenResult(null)}>Dismiss</button>
        </div>
      )}

      <div className="dx-panel">
        {/* ── Tab strip + search ── */}
        <div className="dx-master-data-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="dx-tabs-underline" style={{ flex: 1, borderBottom: 'none', margin: 0, flexWrap: 'wrap' }}>
            {UI_TABS.map((key) => (
              <button
                key={key}
                type="button"
                className={key === tab ? 'dx-tabs-underline--active' : ''}
                onClick={() => { setTab(key); setSearch('') }}
              >
                {TAB_CONFIG[key].label}
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tab === 'material-types' ? 'Search materials or specs…' : `Search ${TAB_CONFIG[tab].label.toLowerCase()}…`}
            style={{ maxWidth: 300 }}
          />
        </div>

        {/* ── Materials tab — accordion ── */}
        {tab === 'material-types' && (
          loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)' }}>Loading materials…</div>
          ) : (
            <MaterialsAccordion
              materials={data.material_types}
              specsGrouped={specsGrouped}
              search={search}
              page={page}
              perPage={perPage}
              onEditMaterial={(mt)    => setModal({ item: mt, tab: 'material-types' })}
              onArchiveMaterial={(mt) => onArchive(mt, 'material-types')}
              onAddSpec={(mtId)       => setModal({ item: { material_type_id: mtId }, tab: 'material-specifications' })}
              onEditSpec={(spec)      => setModal({ item: spec, tab: 'material-specifications' })}
              onArchiveSpec={(spec)   => onArchive(spec, 'material-specifications')}
            />
          )
        )}

        {/* ── All other tabs — standard DataTable ── */}
        {tab !== 'material-types' && (
          <DataTable
            headers={TAB_CONFIG[tab].headers}
            loading={loading}
            empty={<EmptyState icon={Database} title={`No ${TAB_CONFIG[tab].label.toLowerCase()}`} message="Create master data to support dispatch operations." />}
          >
            {pagedRows.map((row) => (
              <tr key={row.id}>
                {tab === 'clients' && <><td>{row.client_name}</td><td>{row.contact_person || '—'}</td><td>{row.email || '—'}</td><td><StatusBadge status={row.status} /></td></>}
                {tab === 'quarries' && <><td>{row.quarry_name}</td><td>{row.contact_person || '—'}</td><td>{row.email || '—'}</td><td><StatusBadge status={row.status} /></td></>}
                {tab === 'vehicle-types' && <><td>{row.name}</td><td>{row.wheel_type || '—'}</td><td>{row.min_cbm != null && row.max_cbm != null ? `${row.min_cbm} - ${row.max_cbm} m³` : '—'}</td><td><StatusBadge status={row.status} /></td></>}
                {tab === 'vehicles' && <><td>{row.plate_no}</td><td>{row.vehicleType?.name || row.type || '—'}</td><td>{row.cbm_capacity ? `${row.cbm_capacity} m³` : '—'}</td><td><StatusBadge status={row.status} /></td></>}
                {tab === 'drivers' && (
                  <>
                    <td>
                      <div style={{ fontWeight: 500 }}>{row.full_name || row.user?.name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                        <StatusBadge status={row.availability || 'available'} />
                      </div>
                    </td>
                    <td>{row.license_no || '—'}</td>
                    <td>
                      {row.user ? (
                        <div>
                          <div style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{row.user.email}</div>
                          <StatusBadge status={row.user.status || 'active'} />
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>No account</span>
                      )}
                    </td>
                    <td>
                      {row.user_id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: '#16a34a' }}>
                          <Link2 size={12} /> Linked
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: '#d97706' }}>
                          Unlinked
                        </span>
                      )}
                    </td>
                  </>
                )}
                {tab === 'driver-vehicle-assignments' && <><td>{row.driver?.full_name || '—'}</td><td>{row.vehicle?.plate_no || '—'}</td><td>{row.is_primary ? 'Yes' : 'No'}</td><td><StatusBadge status={row.status} /></td></>}
                <td>
                  <div className="dx-text-actions">
                    <button type="button" onClick={() => setModal({ item: row, tab })}>Edit</button>
                    {tab === 'drivers' && !row.user_id && (
                      <button
                        type="button"
                        style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        disabled={generatingId === row.id}
                        onClick={() => onGenerateAccount(row.id)}
                      >
                        {generatingId === row.id
                          ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                          : <><UserPlus size={12} /> Generate Account</>
                        }
                      </button>
                    )}
                    <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => onArchive(row)}>Archive</button>
                  </div>
                </td>
              </tr>
            ))}
            {pagedRows.length === 0 && !loading && (
              <tr>
                <td colSpan={TAB_CONFIG[tab].headers.length} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No records found.
                </td>
              </tr>
            )}
          </DataTable>
        )}

        {/* ── Pagination bar ── */}
        {!loading && paginationTotal > 0 && (
          <PaginationBar
            page={page}
            perPage={perPage}
            total={paginationTotal}
            onPage={setPage}
          />
        )}
      </div>

      {/* ── Modal — uses modal.tab (not page tab) ── */}
      {modal !== null && (
        <MasterRecordModal
          tab={modal.tab}
          item={modal.item}
          data={data}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); flash('Saved successfully.'); load() }}
        />
      )}

      {credentialModal && (
        <div className="dx-modal-backdrop" onClick={() => setCredentialModal(null)}>
          <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal style={{ maxWidth: 480 }}>
            <div className="dx-modal-header">
              <h2>Driver account created</h2>
              <button type="button" className="dx-modal-close" onClick={() => setCredentialModal(null)}>×</button>
            </div>
            <div style={{ padding: '20px 28px 28px' }}>
              <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
                Share these credentials with <strong>{credentialModal.driverName}</strong>. They must change password on first login.
              </p>
              <p style={{ margin: '0 0 6px' }}><strong>Email:</strong> {credentialModal.email}</p>
              <p style={{ margin: '0 0 16px' }}><strong>Temporary password:</strong> <code>{credentialModal.password}</code></p>
              <button type="button" className="btn-dx-primary" onClick={() => setCredentialModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {confirmationModal}
    </>
  )
}

export default AdminMasterDataPage
