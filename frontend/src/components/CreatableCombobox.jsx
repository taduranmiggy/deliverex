import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'

/**
 * Generic searchable combobox with optional custom value creation.
 *
 * value: { type: 'existing', id, label } | { type: 'custom', label } | null
 */
function CreatableCombobox({
  items = [],
  getItemId = (item) => item.id,
  getItemLabel = (item) => item.name,
  getItemMeta,
  value,
  onChange,
  loading = false,
  saving = false,
  disabled = false,
  error = null,
  success = null,
  placeholder = 'Search or type…',
  customOptionLabel = (query) => `Use custom: ${query}`,
  emptyMessage = 'No matching options.',
  hint = null,
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
    if (!q) return items.slice(0, 50)
    return items.filter((item) => getItemLabel(item).toLowerCase().includes(q)).slice(0, 50)
  }, [items, query, getItemLabel])

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return items.find((item) => getItemLabel(item).toLowerCase() === q) ?? null
  }, [items, query, getItemLabel])

  const trimmedQuery = query.trim()
  const showCustomOption = trimmedQuery.length > 0 && !exactMatch

  const selectExisting = (item) => {
    onChange({ type: 'existing', id: getItemId(item), label: getItemLabel(item) })
    setQuery(getItemLabel(item))
    setOpen(false)
  }

  const selectCustom = () => {
    if (!trimmedQuery) return
    onChange({ type: 'custom', label: trimmedQuery })
    setQuery(trimmedQuery)
    setOpen(false)
  }

  const clear = () => {
    onChange(null)
    setQuery('')
    inputRef.current?.focus()
  }

  const isDisabled = disabled || loading || saving

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {hint && (
        <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'var(--muted)' }}>{hint}</p>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `1.5px solid ${error ? 'var(--color-error)' : open ? 'var(--color-primary)' : 'var(--stroke)'}`,
          borderRadius: 10,
          padding: '0 10px',
          background: isDisabled ? 'var(--slate-50)' : '#fff',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {(loading || saving) ? (
          <Loader2 size={16} style={{ flexShrink: 0, animation: 'spin 0.7s linear infinite', color: 'var(--muted)' }} />
        ) : (
          <Search size={16} style={{ flexShrink: 0, color: 'var(--muted)' }} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayValue}
          disabled={isDisabled}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-expanded={open}
          onFocus={() => { if (!isDisabled) { setOpen(true); setQuery(displayValue) } }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (exactMatch) selectExisting(exactMatch)
              else if (showCustomOption) selectCustom()
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
        {displayValue && !isDisabled && (
          <button type="button" onClick={clear} aria-label="Clear" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={15} />
          </button>
        )}
        <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>

      {success && !error && (
        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--color-success, #166534)' }}>{success}</p>
      )}

      {open && !isDisabled && (
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
            <div style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--muted)' }}>Loading…</div>
          )}

          {!loading && filtered.length === 0 && !showCustomOption && (
            <div style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--muted)' }}>{emptyMessage}</div>
          )}

          {filtered.map((item) => {
            const id = getItemId(item)
            const label = getItemLabel(item)
            const selected = value?.type === 'existing' && String(value.id) === String(id)
            const meta = getItemMeta?.(item)
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectExisting(item)}
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
                <strong>{label}</strong>
                {meta && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{meta}</span>
                )}
              </button>
            )
          })}

          {showCustomOption && (
            <button
              type="button"
              role="option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectCustom}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderTop: filtered.length ? '1px solid var(--stroke)' : 'none',
                background: '#fffbeb',
                padding: '10px 14px',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: '0.875rem',
                color: '#92400e',
              }}
            >
              {customOptionLabel(trimmedQuery)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default CreatableCombobox
