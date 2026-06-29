import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createCompany, fetchCompanies, updateCompany,
} from '../../api/admin'
import { DataTable, EmptyState, PageHeader, PaginationBar, SearchInput, StatusBadge } from '../../components/ui'
import { Building2, Plus } from 'lucide-react'

const BLANK = {
  company_name: '',
  company_email: '',
  contact_person: '',
  contact_number: '',
  address: '',
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending_activation', label: 'Legacy Pending' },
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
          <h2 id="company-modal-title">{isEdit ? 'Edit Company' : 'Add Company'}</h2>
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
          {error && <p className="notice error" style={{ margin: 0, gridColumn: '1/-1' }}>{error}</p>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-dx-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save company'}</button>
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
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 6 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)

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
      const params = new URLSearchParams({ page: String(page), per_page: '6' })
      if (search) params.set('search', search)
      if (statusTab !== 'all') params.set('status', statusTab)
      const res = await fetchCompanies(params.toString())
      setCompanies(res.data || [])
      setMeta({
        current_page: res.current_page || 1,
        last_page: res.last_page || 1,
        total: res.total || 0,
        per_page: res.per_page || 6,
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
    setMsg(isEdit ? 'Company updated.' : `Company ${saved.company_name} created.`)
    load()
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
        subtitle={`Manage company records and associations · ${meta.total} total`}
      >
        <button type="button" className="btn-dx-primary" onClick={() => setModal({})}>
          <Plus size={16} /> Add Company
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
              message={hasActiveFilters ? 'Try adjusting your status filter or search.' : 'Add a company record to make it available for customer account assignment.'}
              action={!hasActiveFilters ? (
                <button type="button" className="btn-dx-primary" onClick={() => setModal({})}>
                  <Plus size={16} /> Add Company
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
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        {meta.total > 0 && (
          <PaginationBar
            page={meta.current_page}
            perPage={6}
            total={meta.total}
            onPage={setPage}
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
