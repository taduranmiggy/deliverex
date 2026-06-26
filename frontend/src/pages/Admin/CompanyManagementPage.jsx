import { useCallback, useEffect, useState } from 'react'
import {
  createCompany, fetchCompanies, resendCompanyActivation, updateCompany,
} from '../../api/admin'
import { DataTable, EmptyState, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import { Building2, Mail, Plus } from 'lucide-react'

const BLANK = {
  company_name: '',
  company_email: '',
  contact_person: '',
  contact_number: '',
  address: '',
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending_activation', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
]

function CompanyModal({ company, onClose, onSaved }) {
  const isEdit = Boolean(company?.id)
  const [form, setForm] = useState(isEdit ? { ...company } : BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form }
      if (isEdit) {
        onSaved(await updateCompany(company.id, payload), true)
      } else {
        onSaved(await createCompany(payload), false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="dx-modal-header">
          <h2>{isEdit ? 'Edit Company' : 'Create Company'}</h2>
          <button type="button" className="dx-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="form-grid" style={{ padding: '20px 28px 28px', gridTemplateColumns: '1fr 1fr' }} onSubmit={handleSubmit}>
          <label style={{ gridColumn: '1/-1' }}>Company name <input required value={form.company_name} onChange={set('company_name')} /></label>
          <label style={{ gridColumn: '1/-1' }}>Company email <input required type="email" value={form.company_email} onChange={set('company_email')} disabled={isEdit && company?.status === 'active'} /></label>
          <label>Contact person <input value={form.contact_person ?? ''} onChange={set('contact_person')} /></label>
          <label>Contact number <input value={form.contact_number ?? ''} onChange={set('contact_number')} /></label>
          <label style={{ gridColumn: '1/-1' }}>Address <textarea rows={2} value={form.address ?? ''} onChange={set('address')} /></label>
          {isEdit && (
            <label style={{ gridColumn: '1/-1' }}>Status
              <select value={form.status} onChange={set('status')}>
                <option value="pending_activation">Pending activation</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          )}
          {!isEdit && (
            <p style={{ gridColumn: '1/-1', margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              An activation email (72-hour link) will be sent to the company email. The owner sets their password when activating.
            </p>
          )}
          {error && <p className="notice error" style={{ margin: 0, gridColumn: '1/-1' }}>{error}</p>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create & send activation'}</button>
            <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CompanyManagementPage() {
  const [companies, setCompanies] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [resendingId, setResendingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('search', search.trim())
      if (statusTab !== 'all') params.set('status', statusTab)
      const res = await fetchCompanies(params.toString())
      setCompanies(res.data || [])
      setMeta({
        current_page: res.current_page || 1,
        last_page: res.last_page || 1,
        total: res.total || 0,
        per_page: res.per_page || 20,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusTab])

  useEffect(() => { load() }, [load])

  const handleSaved = (saved, isEdit) => {
    setModal(null)
    setMsg(isEdit ? 'Company updated.' : `Company created. Activation email sent to ${saved.company_email}.`)
    load()
  }

  const handleResend = async (company) => {
    setResendingId(company.id)
    setMsg('')
    setError('')
    try {
      await resendCompanyActivation(company.id)
      setMsg(`Activation email resent to ${company.company_email}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setResendingId(null)
    }
  }

  return (
    <>
      <PageHeader title="Company Management" subtitle="Create B2B company accounts and manage activation">
        <button type="button" className="btn-dx-primary" onClick={() => setModal({})}>
          <Plus size={16} /> New company
        </button>
      </PageHeader>

      {msg && <p className="notice" style={{ marginTop: 12 }}>{msg}</p>}
      {error && <p className="notice error" style={{ marginTop: 12 }}>{error}</p>}

      <div className="dx-panel" style={{ marginTop: 16 }}>
        <div className="dx-filter-bar" style={{ marginBottom: 16 }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search company name or email…" />
          <div className="dx-tab-row">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`dx-tab${statusTab === tab.value ? ' dx-tab--active' : ''}`}
                onClick={() => { setStatusTab(tab.value); setPage(1) }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          headers={['Company', 'Email', 'Contact', 'Status', 'Actions']}
          loading={loading}
          empty={
            <EmptyState
              icon={Building2}
              title={search || statusTab !== 'all' ? 'No companies match your filters' : 'No companies yet'}
              message={search || statusTab !== 'all' ? 'Try adjusting your search or status filter.' : 'Create a company to send an activation email to the owner.'}
            />
          }
        >
          {companies.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.company_name}</strong></td>
              <td>{row.company_email}</td>
              <td>{row.contact_person || '—'}{row.contact_number ? ` · ${row.contact_number}` : ''}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-dx-secondary btn-sm" onClick={() => setModal(row)}>Edit</button>
                  {row.status === 'pending_activation' && (
                    <button
                      type="button"
                      className="btn-dx-secondary btn-sm"
                      disabled={resendingId === row.id}
                      onClick={() => handleResend(row)}
                    >
                      <Mail size={14} /> {resendingId === row.id ? 'Sending…' : 'Resend activation'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        {meta.total > 0 && (
          <PaginationBar
            page={meta.current_page}
            perPage={meta.per_page}
            total={meta.total}
            onPage={setPage}
            onPerPage={() => {}}
            perPageOptions={[meta.per_page]}
          />
        )}
      </div>

      {modal !== null && (
        <CompanyModal company={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </>
  )
}

export default CompanyManagementPage
