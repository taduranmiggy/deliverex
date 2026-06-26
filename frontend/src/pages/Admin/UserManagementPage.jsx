import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createUser, deleteUser, fetchRoles, fetchUsers, updateUser } from '../../api/admin'
import { DataTable, EmptyState, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import { Plus, Users } from 'lucide-react'

const BLANK = { name: '', email: '', password: '', phone: '', role_id: '', status: 'active' }

const INTERNAL_ROLE_NAMES = ['admin', 'dispatcher', 'manager']

// Role tabs config — values match role.name (lowercase) from the backend
const ROLE_TABS = [
  { value: 'all',        label: 'All' },
  { value: 'admin',      label: 'Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'manager',    label: 'Manager' },
  { value: 'driver',     label: 'Driver' },
  { value: 'customer',   label: 'Customer' },
]

const STATUS_OPTS = [
  { value: 'all',      label: 'All Statuses' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

// Role badge colour map
const ROLE_COLORS = {
  admin:      { bg: '#fef3c7', color: '#92400e' },
  dispatcher: { bg: '#dbeafe', color: '#1d4ed8' },
  manager:    { bg: '#dcfce7', color: '#15803d' },
  driver:     { bg: '#ede9fe', color: '#6d28d9' },
  customer:   { bg: '#fee2e2', color: '#b91c1c' },
}

function UserModal({ user, roles, onClose, onSaved }) {
  const isEdit = Boolean(user?.id)
  const assignableRoles = roles.filter((r) => INTERNAL_ROLE_NAMES.includes(r.name?.toLowerCase()))
  const [form, setForm] = useState(isEdit
    ? { ...user, password: '', role_id: user.role_id ?? user.role?.id ?? '' }
    : BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const passwordTouchedRef = useRef(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handlePasswordChange = (e) => {
    passwordTouchedRef.current = true
    set('password')(e)
  }

  const handleRoleChange = (e) => {
    setForm((f) => ({ ...f, role_id: e.target.value }))
  }

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
            <input type="password" minLength={isEdit ? 0 : 8} required={!isEdit} value={form.password} onChange={handlePasswordChange} placeholder="Min 8 characters" />
          </label>
          <p style={{ gridColumn: '1/-1', margin: '-8px 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Fleet driver logins are created in <strong>Master Data → Generate Account</strong>. B2B customer accounts are created in <strong>Company Management</strong>.
          </p>
          <label>Phone <input value={form.phone ?? ''} onChange={set('phone')} placeholder="+63 9XX" /></label>
          <label>Role
            <select required value={form.role_id} onChange={handleRoleChange}>
              <option value="">— Select —</option>
              {assignableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
  const [users, setUsers]       = useState([])
  const [roles, setRoles]       = useState([])
  const [error, setError]       = useState('')
  const [msg, setMsg]           = useState('')
  const [modal, setModal]       = useState(null)
  const [loading, setLoading]   = useState(false)
  // Filters
  const [search, setSearch]     = useState('')
  const [roleTab, setRoleTab]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  // Pagination
  const [page, setPage]         = useState(1)
  const [perPage, setPerPage]   = useState(15)

  // Load all users once (high per_page) so counts + filters work client-side
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [res, rolesRes] = await Promise.all([fetchUsers(1, 500), fetchRoles()])
      setUsers(res.data || [])
      setRoles(rolesRes || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1) }, [search, roleTab, statusFilter, perPage])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const handleSaved = (saved, isEdit) => {
    setModal(null)
    flash(`User "${saved.name}" ${isEdit ? 'updated' : 'created'}.`)
    load()
  }

  const handleToggle = async (user) => {
    try {
      await updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' })
      flash('User status updated.')
      load()
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.name}"?`)) return
    try { await deleteUser(user.id); flash('User deleted.'); load() }
    catch (err) { setError(err.message) }
  }

  // Role counts from the full unfiltered list (for tab badges)
  const roleCounts = useMemo(() => {
    const counts = {}
    users.forEach((u) => {
      const r = u.role?.name?.toLowerCase() ?? 'unknown'
      counts[r] = (counts[r] || 0) + 1
    })
    return counts
  }, [users])

  // Apply all filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const roleName = u.role?.name?.toLowerCase() ?? ''
      if (roleTab !== 'all' && roleName !== roleTab) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (q && !u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, roleTab, statusFilter, search])

  // Paginate
  const pagedUsers = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  )

  const hasActiveFilters = roleTab !== 'all' || statusFilter !== 'all' || search

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle={`Manage user accounts and permissions · ${users.length} total`}
      >
        <button className="btn-dx-primary" type="button" onClick={() => setModal({ user: null })}>
          <Plus size={16} /> Add User
        </button>
      </PageHeader>
      {error && <p className="notice error">{error}</p>}
      {msg   && <p className="notice">{msg}</p>}

      <div className="dx-panel">
        {/* ── Role tabs ── */}
        <div className="dx-filter-tabs" style={{ marginBottom: 14 }}>
          {ROLE_TABS.map(({ value, label }) => {
            const count = value === 'all' ? users.length : (roleCounts[value] ?? 0)
            return (
              <button
                key={value}
                type="button"
                className={`dx-filter-tab${roleTab === value ? ' dx-filter-tab--active' : ''}`}
                onClick={() => setRoleTab(value)}
              >
                {label}
                {count > 0 && (
                  <span className="dx-filter-tab__badge">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Search + status filter bar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email…"
            style={{ flex: 1, maxWidth: 320 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10,
              font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)',
              color: 'var(--text)', cursor: 'pointer',
            }}
          >
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-dx-secondary"
              style={{ fontSize: '0.8125rem', padding: '7px 12px' }}
              onClick={() => { setSearch(''); setRoleTab('all'); setStatusFilter('all') }}
            >
              Clear filters
            </button>
          )}
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginLeft: 'auto' }}>
            {filtered.length === users.length
              ? `${users.length} users`
              : `${filtered.length} of ${users.length} users`}
          </span>
        </div>

        {/* ── Table ── */}
        <DataTable
          headers={['Name', 'Email', 'Role', 'Status', 'Actions']}
          loading={loading}
          empty={
            <EmptyState
              icon={Users}
              title={hasActiveFilters ? 'No users match your filters' : 'No users found'}
              message={hasActiveFilters ? 'Try adjusting your role tab, status, or search.' : undefined}
            />
          }
        >
          {pagedUsers.map((user) => {
            const roleName = user.role?.name?.toLowerCase() ?? ''
            const roleStyle = ROLE_COLORS[roleName] ?? { bg: 'var(--slate-100)', color: 'var(--slate-600)' }
            return (
              <tr key={user.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="topbar-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', borderRadius: 8, flexShrink: 0 }}>
                      {user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{user.name}</p>
                      {user.phone && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>{user.phone}</p>}
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{user.email}</td>
                <td>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6,
                    background: roleStyle.bg, color: roleStyle.color,
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.role?.name ?? '—'}
                  </span>
                </td>
                <td><StatusBadge status={user.status === 'active' ? 'active' : 'inactive'} /></td>
                <td>
                  <div className="dx-text-actions">
                    <button type="button" onClick={() => setModal({ user })}>Edit</button>
                    <button type="button" onClick={() => handleToggle(user)}>
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(user)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </DataTable>

        {filtered.length > 0 && (
          <PaginationBar
            page={page}
            perPage={perPage}
            total={filtered.length}
            onPage={setPage}
            onPerPage={(n) => { setPerPage(n); setPage(1) }}
          />
        )}
      </div>

      {modal !== null && (
        <UserModal
          user={modal.user}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

export default UserManagementPage
