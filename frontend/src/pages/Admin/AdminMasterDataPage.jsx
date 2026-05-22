import { useCallback, useEffect, useState } from 'react'
import { createDriver, createVehicle, deleteDriver, deleteVehicle, fetchDrivers, fetchUsers, fetchVehicles, updateDriver, updateVehicle } from '../../api/admin'
import { DataTable, EmptyState, PageHeader, SearchInput, StatusBadge } from '../../components/ui'
import { Car, Plus, Users } from 'lucide-react'

/* ── Modals ─────────────────────────────────────────────── */
function VehicleModal({ vehicle, onClose, onSaved }) {
  const isEdit = Boolean(vehicle?.id)
  const [form, setForm] = useState(isEdit
    ? { plate_no: vehicle.plate_no, type: vehicle.type, capacity: vehicle.capacity ?? '', max_weight_kg: vehicle.max_weight_kg ?? '', max_volume_m3: vehicle.max_volume_m3 ?? '', status: vehicle.status ?? 'available' }
    : { plate_no: '', type: '', capacity: '', max_weight_kg: '', max_volume_m3: '', status: 'available' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    const p = { ...form }
    if (p.max_weight_kg === '') delete p.max_weight_kg
    if (p.max_volume_m3 === '') delete p.max_volume_m3
    if (p.capacity === '') delete p.capacity
    try { onSaved(isEdit ? await updateVehicle(vehicle.id, p) : await createVehicle(p)) }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="dx-modal-header"><h2>{isEdit ? 'Edit Vehicle' : 'Add Vehicle'}</h2><button type="button" className="dx-modal-close" onClick={onClose}>×</button></div>
        <form className="form-grid" style={{ padding: '20px 28px 28px', gridTemplateColumns: '1fr 1fr' }} onSubmit={handleSubmit}>
          <label style={{ gridColumn: '1/-1' }}>Plate number <input required value={form.plate_no} onChange={set('plate_no')} placeholder="ABC-1234" /></label>
          <label style={{ gridColumn: '1/-1' }}>Type / Make <input required value={form.type} onChange={set('type')} placeholder="Dump Truck, Flatbed…" /></label>
          <label>Capacity label <input value={form.capacity} onChange={set('capacity')} placeholder="10T" /></label>
          <label>Status <select value={form.status} onChange={set('status')}><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="unavailable">Unavailable</option></select></label>
          <label>Max weight (kg) <input type="number" min="0" step="0.01" value={form.max_weight_kg} onChange={set('max_weight_kg')} /></label>
          <label>Max volume (m³) <input type="number" min="0" step="0.001" value={form.max_volume_m3} onChange={set('max_volume_m3')} /></label>
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

function DriverModal({ driver, users, onClose, onSaved }) {
  const isEdit = Boolean(driver?.id)
  const [form, setForm] = useState(isEdit
    ? { user_id: driver.user_id, license_no: driver.license_no, availability: driver.availability ?? 'available' }
    : { user_id: '', license_no: '', availability: 'available' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try { onSaved(isEdit ? await updateDriver(driver.id, form) : await createDriver(form)) }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="dx-modal-header"><h2>{isEdit ? 'Edit Driver' : 'Add Driver'}</h2><button type="button" className="dx-modal-close" onClick={onClose}>×</button></div>
        <form className="form-grid" style={{ padding: '20px 28px 28px', gridTemplateColumns: '1fr' }} onSubmit={handleSubmit}>
          {!isEdit && (
            <label>User account
              <select required value={form.user_id} onChange={set('user_id')}>
                <option value="">— Select user —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </label>
          )}
          <label>License number <input required value={form.license_no} onChange={set('license_no')} placeholder="LIC-0001" /></label>
          <label>Availability <select value={form.availability} onChange={set('availability')}><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label>
          {error && <p className="notice error" style={{ margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}</button>
            <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────── */
function AdminMasterDataPage() {
  const [tab, setTab]           = useState('vehicles')
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers]   = useState([])
  const [driverUsers, setDriverUsers] = useState([])
  const [error, setError]       = useState('')
  const [msg, setMsg]           = useState('')
  const [modal, setModal]       = useState(null)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [vRes, dRes, uRes] = await Promise.all([fetchVehicles(1), fetchDrivers(1), fetchUsers(1)])
      setVehicles(vRes.data || [])
      setDrivers(dRes.data || [])
      setDriverUsers((uRes.data || []).filter((u) => u.role?.name === 'driver'))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const handleSaved = () => { setModal(null); flash('Saved successfully.'); load() }
  const handleDelete = async (type, id, label) => {
    if (!window.confirm(`Delete ${label}?`)) return
    try {
      if (type === 'vehicle') await deleteVehicle(id)
      else await deleteDriver(id)
      flash('Deleted.'); load()
    } catch (err) { setError(err.message) }
  }

  const vehicleStatus = (s) => ({
    available:   'badge-dx badge-dx--available',
    assigned:    'badge-dx badge-dx--dispatched',
    maintenance: 'badge-dx badge-dx--maintenance',
    unavailable: 'badge-dx badge-dx--cancelled',
  }[s] ?? 'badge-dx badge-dx--muted')

  const filteredV = vehicles.filter((v) => !search || v.plate_no?.toLowerCase().includes(search.toLowerCase()) || v.type?.toLowerCase().includes(search.toLowerCase()))
  const filteredD = drivers.filter((d) => !search || d.user?.name?.toLowerCase().includes(search.toLowerCase()) || d.license_no?.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <PageHeader title="Master Data" subtitle="Manage fleet vehicles and driver roster">
        <button className="btn-dx-primary" type="button" onClick={() => setModal({ item: null })}>
          <Plus size={16} /> {tab === 'vehicles' ? 'Add Vehicle' : 'Add Driver'}
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}

      <div className="dx-panel">
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="dx-tabs-underline" style={{ flex: 1, borderBottom: 'none', margin: 0 }}>
            {['vehicles', 'drivers'].map((t) => (
              <button key={t} type="button" className={t === tab ? 'dx-tabs-underline--active' : ''} onClick={() => { setTab(t); setSearch('') }} style={{ textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${tab}…`} style={{ maxWidth: 280 }} />
        </div>

        {tab === 'vehicles' ? (
          <DataTable headers={['Plate', 'Type', 'Capacity', 'Max Weight', 'Max Vol.', 'Status', 'Actions']} loading={loading}
            empty={<EmptyState icon={Car} title="No vehicles" message="Add your first vehicle to get started." />}
          >
            {filteredV.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.plate_no}</strong></td>
                <td>{v.type}</td>
                <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{v.capacity ?? '—'}</td>
                <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{v.max_weight_kg ? `${v.max_weight_kg} kg` : '—'}</td>
                <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{v.max_volume_m3 ? `${v.max_volume_m3} m³` : '—'}</td>
                <td><span className={vehicleStatus(v.status)} style={{ textTransform: 'capitalize' }}>{v.status}</span></td>
                <td>
                  <div className="dx-text-actions">
                    <button type="button" onClick={() => setModal({ item: v })}>Edit</button>
                    <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete('vehicle', v.id, v.plate_no)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <DataTable headers={['Driver', 'License', 'Availability', 'Actions']} loading={loading}
            empty={<EmptyState icon={Users} title="No drivers" />}
          >
            {filteredD.map((d) => (
              <tr key={d.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="topbar-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', borderRadius: 8, flexShrink: 0 }}>
                      {(d.user?.name ?? 'DR').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.user?.name ?? '—'}</p>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{d.license_no}</td>
                <td><StatusBadge status={d.availability} /></td>
                <td>
                  <div className="dx-text-actions">
                    <button type="button" onClick={() => setModal({ item: d })}>Edit</button>
                    <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete('driver', d.id, d.user?.name ?? `Driver #${d.id}`)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {modal !== null && tab === 'vehicles' && <VehicleModal vehicle={modal.item} onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal !== null && tab === 'drivers'  && <DriverModal driver={modal.item} users={driverUsers} onClose={() => setModal(null)} onSaved={handleSaved} />}
    </>
  )
}

export default AdminMasterDataPage
