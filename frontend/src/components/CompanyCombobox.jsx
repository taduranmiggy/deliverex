import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'

/**
 * Searchable combobox for selecting an active B2B company.
 *
 * value: { type: 'existing', companyId: string|number, label: string } | null
 */
function CompanyCombobox({
  companies = [],
  value,
  onChange,
  loading = false,
  disabled = false,
  error = null,
  placeholder = 'Search company…',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const displayValue = value?.label ?? ''

  useEffect(() => {
    if (!open) setQuery(displayValue)
  }, [displayValue, open])

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies.slice(0, 50)
    return companies.filter((c) => {
      const name = (c.company_name || c.client_name || '').toLowerCase()
      const email = (c.company_email || c.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    }).slice(0, 50)
  }, [companies, query])

  const selectExisting = (company) => {
    const label = company.company_name || company.client_name
    onChange({ type: 'existing', companyId: company.id, clientId: company.id, label })
    setQuery(label)
    setOpen(false)
  }

  const clear = () => {
    onChange(null)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `1.5px solid ${error ? 'var(--color-error)' : open ? 'var(--color-primary)' : 'var(--stroke)'}`,
          borderRadius: 10,
          padding: '0 10px',
          background: disabled ? 'var(--slate-50)' : '#fff',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
        }}
      >
        {loading ? <Loader2 size={16} style={{ flexShrink: 0, animation: 'spin 0.7s linear infinite', color: 'var(--muted)' }} /> : <Search size={16} style={{ flexShrink: 0, color: 'var(--muted)' }} />}
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayValue}
          disabled={disabled || loading}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => { setOpen(true); setQuery(displayValue) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault()
              selectExisting(filtered[0])
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '10px 0',
            font: 'inherit',
            fontSize: '0.875rem',
            background: 'transparent',
          }}
        />
        {displayValue && !disabled && (
          <button type="button" onClick={clear} aria-label="Clear company" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={15} />
          </button>
        )}
        <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--stroke)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
          }}
        >
          {loading && (
            <div style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--muted)' }}>Loading companies…</div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              {companies.length === 0 ? 'No active companies. Ask admin to create one.' : 'No matching companies.'}
            </div>
          )}

          {filtered.map((company) => {
            const selected = value?.type === 'existing' && String(value.companyId) === String(company.id)
            const name = company.company_name || company.client_name
            return (
              <button
                key={company.id}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectExisting(company)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: selected ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: '0.875rem',
                }}
              >
                <strong>{name}</strong>
                {(company.contact_person || company.company_email || company.email) && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                    {[company.contact_person, company.company_email || company.email, company.contact_number || company.phone].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CompanyCombobox
