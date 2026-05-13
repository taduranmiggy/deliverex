import { useCallback, useEffect, useState } from 'react'
import { createUser, deleteUser, fetchRoles, fetchUsers, updateUser } from '../../api/admin'
import { DataTable, EmptyState, PageHeader, SearchInput, StatusBadge } from '../../components/ui'
import { Plus, Users } from 'lucide-react'

const BLANK = { name: '', email: '', password: '', phone: '', role_id: '', status: 'active' }

function UserModal({ user, roles, onClose, onSaved }) {
  const isEdit = Boolean(user?.id)
  const [form, setForm] = useState(isEdit
    ? { ...user, password: '', role_id: user.role_id ?? user.role?.id ?? '' }
    : BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form }
    if (!payload.password) delete payload.password
    try {
      onSaved(isEdit ? await updateUser(user.id, payload) : await createUser(payload), isEdit)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="dx-modal-header">
          <h2>{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button type="button" className="dx-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="form-grid" style={{ padding: '20px 28px 28px', gridTemplateColumns: '1fr 1fr' }} onSubmit={handleSubmit}>
          <label style={{ gridColumn: '1/-1' }}>Full name <input required value={form.name} onChange={set('name')} placeholder="Maria Santos" /></label>
          <label style={{ gridColumn: '1/-1' }}>Email <input required type="email" value={form.email} onChange={set('email')} /></label>
          <label style={{ gridColumn: '1/-1' }}>{isEdit ? 'New password (blank = keep)' : 'Password'}
            <input type="password" minLength={isEdit ? 0 : 8} required={!isEdit} value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
          </label>
          <label>Phone <input value={form.phone ?? ''} onChange={set('phone')} placeholder="+63 9XX" /></label>
          <label>Role
            <select required value={form.role_id} onChange={set('role_id')}>
              <option value="">— Select —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label>Status
            <select value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {error && <p className="notice error" style={{ margin: 0, gridColumn: '1/-1' }}>{error}</p>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}</button>
            <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UserManagementPage() {
  const [users, setUsers]   = useState([])
  const [roles, setRoles]   = useState([])
  const [error, setError]   = useState('')
  const [msg, setMsg]       = useState('')
  const [modal, setModal]   = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [meta, setMeta]     = useState({ last_page: 1, total: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    setError('')
    try {
      const [res, rolesRes] = await Promise.all([fetchUsers(p), fetchRoles()])
      setUsers(res.data || [])
      setMeta({ last_page: res.last_page ?? 1, total: res.total ?? 0 })
      setRoles(rolesRes || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page) }, [page]) // eslint-disable-line

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const handleSaved = (saved, isEdit) => {
    setModal(null)
    flash(`User "${saved.name}" ${isEdit ? 'updated' : 'created'}.`)
    load(page)
  }

  const handleToggle = async (user) => {
    try {
      await updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' })
      flash('User status updated.')
      load(page)
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.name}"?`)) return
    try { await deleteUser(user.id); flash('User deleted.'); load(page) }
    catch (err) { setError(err.message) }
  }

  const filtered = users.filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <PageHeader title="Users & Roles" subtitle={`Manage user accounts and permissions${meta.total ? ` · ${meta.total} total` : ''}`}>
        <button className="btn-dx-primary" type="button" onClick={() => setModal({ user: null })}>
          <Plus size={16} /> Add User
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}

      <div className="dx-panel">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" style={{ maxWidth: 320, flex: 1 }} />
          <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{filtered.length} users</span>
        </div>

        <DataTable
          headers={['Name', 'Email', 'Role', 'Status', 'Actions']}
          loading={loading}
          empty={<EmptyState icon={Users} title="No users found" />}
        >
          {filtered.length > 0 && filtered.map((user) => (
            <tr key={user.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="topbar-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', borderRadius: 8, flexShrink: 0 }}>
                    {user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.name}</p>
                  </div>
                </div>
              </td>
              <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{user.email}</td>
              <td><span style={{ padding: '3px 10px', borderRadius: 6, background: 'var(--slate-100)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{user.role?.name ?? '—'}</span></td>
              <td><StatusBadge status={user.status === 'active' ? 'active' : 'inactive'} /></td>
              <td>
                <div className="dx-text-actions">
                  <button type="button" onClick={() => setModal({ user })}>Edit</button>
                  <button type="button" onClick={() => handleToggle(user)}>{user.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(user)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        {meta.last_page > 1 && (
          <div className="dx-pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page} of {meta.last_page}</span>
            <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {modal !== null && <UserModal user={modal.user} roles={roles} onClose={() => setModal(null)} onSaved={handleSaved} />}
    </>
  )
}

export default UserManagementPage
