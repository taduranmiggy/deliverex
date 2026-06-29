import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createCompanyUser, deleteCompanyUser, fetchCompanyUsers, updateCompanyUser,
} from '../../api/customerPortal'
import useAuth from '../../hooks/useAuth'
import CustomerPageShell, { CustomerPageHeader } from '../../components/customer/CustomerPageShell'
import PhonePhInput from '../../components/PhonePhInput'
import UserNameFields from '../../components/UserNameFields'
import { useCustomerSurface } from '../../context/CustomerSurfaceContext'
import { generateInitialPassword, validateGeneratedPassword } from '../../utils/generateInitialPassword'
import { composeFullName, validateNameParts } from '../../utils/nameParts'
import { parsePhoneForInput, validatePhPhone } from '../../utils/phonePh'
import { Users } from 'lucide-react'

const BLANK = {
  first_name: '',
  middle_initial: '',
  last_name: '',
  email: '',
  phone: '',
  role: 'staff',
}

function CustomerCompanyUsersPage() {
  const { user } = useAuth()
  const { paths } = useCustomerSurface()
  const isOwner = user?.company_role === 'owner'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(BLANK)
  const [fieldErrors, setFieldErrors] = useState({})
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

  const existingUsers = useMemo(
    () => rows.map((r) => r.user).filter(Boolean),
    [rows],
  )

  const validate = () => {
    const errors = { ...validateNameParts(form) }

    const email = String(form.email ?? '').trim()
    if (!email) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'

    const phoneErr = validatePhPhone(form.phone, { required: true })
    if (phoneErr) errors.phone = phoneErr

    const pwd = generateInitialPassword(form.last_name, parsePhoneForInput(form.phone))
    const pwdErr = validateGeneratedPassword(pwd)
    if (pwdErr) errors._password = pwdErr

    const phoneDigits = parsePhoneForInput(form.phone)
    if (phoneDigits && existingUsers.some((u) => parsePhoneForInput(u.phone) === phoneDigits)) {
      errors.phone = 'This phone number is already assigned to another team member.'
    }

    return errors
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: composeFullName(form),
        email: String(form.email).trim(),
        phone: form.phone,
        role: form.role,
        password: generateInitialPassword(form.last_name, parsePhoneForInput(form.phone)),
      }
      await createCompanyUser(payload)
      setForm(BLANK)
      setFieldErrors({})
      setMsg('Team member added. An invitation email will include their login details.')
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

  const nameValues = useMemo(() => ({
    first_name: form.first_name,
    middle_initial: form.middle_initial,
    last_name: form.last_name,
  }), [form.first_name, form.middle_initial, form.last_name])

  if (!isOwner) {
    return (
      <CustomerPageShell className="pwa-page">
        <CustomerPageHeader title="Team" description="Only company owners can manage team members." />
        <p><Link to={paths.profile}>Back to account</Link></p>
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
        <form className="pwa-form-card" onSubmit={handleCreate} noValidate>
          <UserNameFields
            values={nameValues}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            errors={fieldErrors}
            disabled={saving}
            idPrefix="company-user"
          />
          <label>
            Email <span className="dx-required">*</span>
            <input required type="email" value={form.email} onChange={set('email')} disabled={saving} />
            {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
          </label>
          <label>
            Phone <span className="dx-required">*</span>
            <PhonePhInput
              value={form.phone}
              onChange={(phone) => setForm((f) => ({ ...f, phone }))}
              required
              disabled={saving}
              error={fieldErrors.phone}
            />
            {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
          </label>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Initial password is generated automatically as <strong>LastName_last4</strong> of the phone number and sent via invitation email.
          </p>
          <label>
            Role
            <select value={form.role} onChange={set('role')} disabled={saving}>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          {fieldErrors._password && <p className="notice error" style={{ margin: 0 }}>{fieldErrors._password}</p>}
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

      <p><Link to={paths.profile}>Back to account</Link></p>
    </CustomerPageShell>
  )
}

export default CustomerCompanyUsersPage
