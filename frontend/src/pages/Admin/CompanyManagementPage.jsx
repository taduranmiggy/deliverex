import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

  useEffect(() => {
    document.body.classList.add('dx-nav-locked')
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('dx-nav-locked')
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

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

  return createPortal(
    <div className="dx-modal-backdrop" onClick={onClose}>
      <div className="dx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-labelledby="company-modal-title">
        <div className="dx-modal-header">
          <h2 id="company-modal-title">{isEdit ? 'Edit Company' : 'Create Company'}</h2>
          <button type="button" className="dx-modal-close" onClick={onClose} aria-label="Close">×</button>
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
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create & send activation'}</button>
            <button type="button" className="btn-dx-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function CompanyManagementPage() {
  const [companies, setCompanies] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [resendingId, setResendingId] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, statusTab])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
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
      setCompanies([])
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

  const hasActiveFilters = statusTab !== 'all' || searchInput.trim() !== ''

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatusTab('all')
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Company Management"
        subtitle={`Create B2B company accounts and manage activation · ${meta.total} total`}
      >
        <button type="button" className="btn-dx-primary" onClick={() => setModal({})}>
          <Plus size={16} /> New company
        </button>
      </PageHeader>

      {msg && <p className="notice">{msg}</p>}
      {error && <p className="notice error">{error}</p>}

      <div className="dx-panel">
        <div className="dx-filter-tabs" style={{ marginBottom: 14 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`dx-filter-tab${statusTab === tab.value ? ' dx-filter-tab--active' : ''}`}
              onClick={() => setStatusTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search company name or email…"
            style={{ flex: '1 1 240px', maxWidth: 360, minWidth: 200 }}
          />
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-dx-secondary"
              style={{ fontSize: '0.8125rem', padding: '7px 12px' }}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginLeft: 'auto' }}>
            {loading ? 'Loading…' : `${meta.total} ${meta.total === 1 ? 'company' : 'companies'}`}
          </span>
        </div>

        <DataTable
          headers={['Company', 'Email', 'Contact', 'Status', 'Actions']}
          loading={loading}
          empty={
            <EmptyState
              icon={Building2}
              title={hasActiveFilters ? 'No companies match your filters' : 'No companies yet'}
              message={hasActiveFilters ? 'Try adjusting your status filter or search.' : 'Create a company to send an activation email to the owner.'}
              action={!hasActiveFilters ? (
                <button type="button" className="btn-dx-primary" onClick={() => setModal({})}>
                  <Plus size={16} /> New company
                </button>
              ) : undefined}
            />
          }
        >
          {companies.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.company_name}</strong>
              </td>
              <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{row.company_email}</td>
              <td style={{ fontSize: '0.875rem' }}>
                {row.contact_person || '—'}
                {row.contact_number ? ` · ${row.contact_number}` : ''}
              </td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="dx-text-actions">
                  <button type="button" onClick={() => setModal(row)}>Edit</button>
                  {row.status === 'pending_activation' && (
                    <button
                      type="button"
                      disabled={resendingId === row.id}
                      onClick={() => handleResend(row)}
                    >
                      <Mail size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      {resendingId === row.id ? 'Sending…' : 'Resend activation'}
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
