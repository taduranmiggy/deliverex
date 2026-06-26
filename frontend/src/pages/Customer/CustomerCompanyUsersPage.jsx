import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createCompanyUser, deleteCompanyUser, fetchCompanyUsers, updateCompanyUser,
} from '../../api/customerPortal'
import useAuth from '../../hooks/useAuth'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import { Users } from 'lucide-react'

const BLANK = { name: '', email: '', phone: '', password: '', role: 'staff' }

function CustomerCompanyUsersPage() {
  const { user } = useAuth()
  const isOwner = user?.company_role === 'owner'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchCompanyUsers()
      setRows(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isOwner) load() }, [isOwner, load])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createCompanyUser(form)
      setForm(BLANK)
      setMsg('Team member added.')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row) => {
    try {
      await updateCompanyUser(row.id, { is_active: !row.is_active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const removeUser = async (row) => {
    if (!window.confirm(`Remove ${row.user?.name}?`)) return
    try {
      await deleteCompanyUser(row.id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isOwner) {
    return (
      <CustomerPageShell className="pwa-page">
        <CustomerPageHeader title="Team" description="Only company owners can manage team members." />
        <p><Link to="/customer/account">Back to account</Link></p>
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell className="pwa-page">
      <CustomerPageHeader
        eyebrow={user?.company_name}
        title="Team members"
        description="Add staff or viewer accounts for your company."
      />

      {msg && <p className="notice">{msg}</p>}
      {error && <p className="notice error">{error}</p>}

      <section className="pwa-section">
        <h2 className="pwa-section__title">Add member</h2>
        <form className="pwa-form-card" onSubmit={handleCreate}>
          <label>Name <input required value={form.name} onChange={set('name')} /></label>
          <label>Email <input required type="email" value={form.email} onChange={set('email')} /></label>
          <label>Phone <input value={form.phone} onChange={set('phone')} /></label>
          <label>Temporary password <input required type="password" minLength={8} value={form.password} onChange={set('password')} /></label>
          <label>Role
            <select value={form.role} onChange={set('role')}>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Adding…' : 'Add member'}</button>
        </form>
      </section>

      <section className="pwa-section">
        <h2 className="pwa-section__title"><Users size={18} /> Current members</h2>
        {loading ? <p>Loading…</p> : (
          <div className="pwa-form-card">
            {rows.map((row) => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--stroke)' }}>
                <div>
                  <strong>{row.user?.name}</strong>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{row.user?.email} · {row.role}</div>
                </div>
                {row.role !== 'owner' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-dx-secondary btn-sm" onClick={() => toggleActive(row)}>
                      {row.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="btn-dx-secondary btn-sm" onClick={() => removeUser(row)}>Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p><Link to="/customer/account">Back to account</Link></p>
    </CustomerPageShell>
  )
}

export default CustomerCompanyUsersPage
