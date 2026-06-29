import { useCallback, useEffect, useMemo, useState } from 'react'
import { createUser, deleteUser, fetchCompanies, fetchRoles, fetchUsers, sendUserInvite, updateUser } from '../../api/admin'
import CompanyCombobox from '../../components/CompanyCombobox'
import PhonePhInput from '../../components/PhonePhInput'
import UserNameFields from '../../components/UserNameFields'
import { DataTable, EmptyState, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import { composeFullName, splitFullName, validateNameParts } from '../../utils/nameParts'
import { parsePhoneForInput, validatePhPhone } from '../../utils/phonePh'
import { Plus, Users } from 'lucide-react'

const PAGE_SIZE = 6

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
  { value: 'pending',  label: 'Pending' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const ROLE_COLORS = {
  admin:      { bg: '#fef3c7', color: '#92400e' },
  dispatcher: { bg: '#dbeafe', color: '#1d4ed8' },
  manager:    { bg: '#dcfce7', color: '#15803d' },
  driver:     { bg: '#ede9fe', color: '#6d28d9' },
  customer:   { bg: '#fee2e2', color: '#b91c1c' },
}

function buildEditForm(user) {
  const parts = splitFullName(user?.name)
  return {
    ...parts,
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
    role_id: user?.role_id ?? user?.role?.id ?? '',
    status: user?.status ?? 'active',
    company_id: user?.company_id ?? '',
    company_role: user?.company_role ?? 'owner',
  }
}

function buildCreateForm() {
  return {
    first_name: '',
    middle_initial: '',
    last_name: '',
    email: '',
    phone: '',
    role_id: '',
    company_id: '',
    company_role: 'owner',
  }
}

function UserModal({ user, roles, companies, existingUsers, onClose, onSaved }) {
  const isEdit = Boolean(user?.id)
  const roleNameById = useMemo(
    () => Object.fromEntries((roles || []).map((r) => [String(r.id), r.name?.toLowerCase()])),
    [roles],
  )
  const assignableRoles = roles
    .filter((r) => ['admin', 'dispatcher', 'manager', 'driver', 'customer'].includes(r.name?.toLowerCase()))
    .sort((a, b) => {
      const order = ['admin', 'manager', 'dispatcher', 'driver', 'customer']
      return order.indexOf(a.name?.toLowerCase()) - order.indexOf(b.name?.toLowerCase())
    })
  const [form, setForm] = useState(isEdit ? buildEditForm(user) : buildCreateForm())
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [companyValue, setCompanyValue] = useState(() => {
    if (!isEdit || !user?.company_id) return null
    return {
      type: 'existing',
      companyId: user.company_id,
      label: user.company_name || 'Not Assigned',
    }
  })

  const selectedRoleName = roleNameById[String(form.role_id)] ?? ''
  const isCustomerRole = selectedRoleName === 'customer'

  useEffect(() => {
    document.body.classList.add('dx-nav-locked')
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('dx-nav-locked')
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, saving])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errors = {
      ...validateNameParts(form),
    }

    const email = String(form.email ?? '').trim()
    if (!email) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'

    const phoneErr = validatePhPhone(form.phone, { required: !isEdit })
    if (phoneErr) errors.phone = phoneErr

    if (!form.role_id) errors.role_id = 'Role is required.'
    if (isCustomerRole && !form.company_id) errors.company_id = 'Company is required for Customer accounts.'
    if (isEdit && form.password && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }

    const phoneDigits = parsePhoneForInput(form.phone)
    if (phoneDigits && existingUsers?.length) {
      const duplicate = existingUsers.find((u) => {
        if (isEdit && u.id === user.id) return false
        return parsePhoneForInput(u.phone) === phoneDigits
      })
      if (duplicate) errors.phone = 'This phone number is already assigned to another user.'
    }

    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError('')

    const payload = {
      name: composeFullName(form),
      email: String(form.email).trim(),
      phone: form.phone || null,
      role_id: form.role_id,
    }

    if (isCustomerRole) {
      payload.company_id = form.company_id
      payload.company_role = form.company_role
    }

    if (isEdit) {
      payload.status = form.status
      if (form.password) payload.password = form.password
    }

    try {
      onSaved(isEdit ? await updateUser(user.id, payload) : await createUser(payload), isEdit)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const nameValues = useMemo(() => ({
    first_name: form.first_name,
    middle_initial: form.middle_initial,
    last_name: form.last_name,
  }), [form.first_name, form.middle_initial, form.last_name])

  return (
    <div className="dx-modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-labelledby="user-modal-title">
        <div className="dx-modal-header">
          <h2 id="user-modal-title">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button type="button" className="dx-modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </div>
        <form className="form-grid" style={{ padding: '20px 28px 28px', gridTemplateColumns: '1fr 1fr' }} onSubmit={handleSubmit} noValidate>
          <UserNameFields
            values={nameValues}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            errors={fieldErrors}
            disabled={saving}
            idPrefix="admin-user"
          />

          <label style={{ gridColumn: '1/-1' }}>
            Email <span className="dx-required">*</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={set('email')}
              disabled={saving}
              aria-invalid={fieldErrors.email ? 'true' : undefined}
            />
            {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
          </label>

          <label style={{ gridColumn: '1/-1' }}>
            Phone {!isEdit && <span className="dx-required">*</span>}
            <PhonePhInput
              value={form.phone}
              onChange={(phone) => setForm((f) => ({ ...f, phone }))}
              required={!isEdit}
              disabled={saving}
              error={fieldErrors.phone}
            />
            {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
          </label>

          {isEdit && (
            <label style={{ gridColumn: '1/-1' }}>
              New password
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={set('password')}
                placeholder="Leave blank to keep current password"
                disabled={saving}
                aria-invalid={fieldErrors.password ? 'true' : undefined}
              />
              {fieldErrors.password && <span className="form-error">{fieldErrors.password}</span>}
            </label>
          )}

          {!isEdit && (
            <p style={{ gridColumn: '1/-1', margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              Submitting creates a pending invitation and sends the user an email to set their own password. New accounts stay <strong>Pending</strong> until accepted.
            </p>
          )}

          <p style={{ gridColumn: '1/-1', margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
            User Management is the single provisioning module for all account roles.
          </p>

          <label>
            Role <span className="dx-required">*</span>
            <select
              required
              value={form.role_id}
              onChange={set('role_id')}
              disabled={saving}
              aria-invalid={fieldErrors.role_id ? 'true' : undefined}
            >
              <option value="">— Select —</option>
              {assignableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {fieldErrors.role_id && <span className="form-error">{fieldErrors.role_id}</span>}
          </label>

          {isCustomerRole && (
            <>
              <label style={{ gridColumn: '1/-1' }}>
                Company <span className="dx-required">*</span>
                <CompanyCombobox
                  companies={companies}
                  value={companyValue}
                  onChange={(next) => {
                    setCompanyValue(next)
                    setForm((f) => ({ ...f, company_id: next?.companyId ?? '' }))
                  }}
                  disabled={saving}
                  error={fieldErrors.company_id}
                />
                {fieldErrors.company_id && <span className="form-error">{fieldErrors.company_id}</span>}
              </label>
              <label>
                Customer role in company
                <select
                  value={form.company_role}
                  onChange={set('company_role')}
                  disabled={saving}
                >
                  <option value="owner">Owner</option>
                  <option value="staff">Staff</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
            </>
          )}

          {isEdit && (
            <label>
              Status
              <select value={form.status} onChange={set('status')} disabled={saving}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          )}

          {error && <p className="notice error" style={{ margin: 0, gridColumn: '1/-1' }}>{error}</p>}

          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Submit'}
            </button>
            <button type="button" className="btn-dx-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UserManagementPage() {
  const [users, setUsers]       = useState([])
  const [roles, setRoles]       = useState([])
  const [companies, setCompanies] = useState([])
  const [error, setError]       = useState('')
  const [msg, setMsg]           = useState('')
  const [modal, setModal]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [roleTab, setRoleTab]   = useState('all')
  const [companyFilter, setCompanyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage]         = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [res, rolesRes, companiesRes] = await Promise.all([
        fetchUsers(1, 500),
        fetchRoles(),
        fetchCompanies('status=active&per_page=500'),
      ])
      setUsers(res.data || [])
      setRoles(rolesRes || [])
      setCompanies(companiesRes?.data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, roleTab, companyFilter, statusFilter])

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

  const handleSendInvite = async (user) => {
    try {
      await sendUserInvite(user.id)
      flash(`Invitation sent to ${user.email}.`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const roleCounts = useMemo(() => {
    const counts = {}
    users.forEach((u) => {
      const r = u.role?.name?.toLowerCase() ?? 'unknown'
      counts[r] = (counts[r] || 0) + 1
    })
    return counts
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const roleName = u.role?.name?.toLowerCase() ?? ''
      if (roleTab !== 'all' && roleName !== roleTab) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (companyFilter && (u.company_name || '').toLowerCase() !== companyFilter.toLowerCase()) return false
      if (q && !u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, roleTab, statusFilter, companyFilter, search])

  const pagedUsers = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  const hasActiveFilters = roleTab !== 'all' || statusFilter !== 'all' || companyFilter || search

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
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            style={{
              padding: '8px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10,
              font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)',
              color: 'var(--text)', cursor: 'pointer',
            }}
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.company_name}>{c.company_name}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-dx-secondary"
              style={{ fontSize: '0.8125rem', padding: '7px 12px' }}
              onClick={() => { setSearch(''); setRoleTab('all'); setStatusFilter('all'); setCompanyFilter('') }}
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

        <DataTable
          headers={['Name', 'Email', 'Company', 'Role', 'Status', 'Actions']}
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
                <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {user.role?.name === 'customer' ? (user.company_name || 'Not Assigned') : '—'}
                </td>
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
                <td><StatusBadge status={user.status} /></td>
                <td>
                  <div className="dx-text-actions">
                    <button type="button" onClick={() => setModal({ user })}>Edit</button>
                    <button type="button" onClick={() => handleToggle(user)}>
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    {user.can_send_invite && (
                      <button type="button" onClick={() => handleSendInvite(user)}>
                        Send Invite
                      </button>
                    )}
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
            perPage={PAGE_SIZE}
            total={filtered.length}
            onPage={setPage}
          />
        )}
      </div>

      {modal !== null && (
        <UserModal
          user={modal.user}
          roles={roles}
          companies={companies}
          existingUsers={users}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

export default UserManagementPage
