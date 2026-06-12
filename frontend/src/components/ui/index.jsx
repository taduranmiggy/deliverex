/**
 * Deliverex Shared UI Components
 * Use these across all roles for visual consistency.
 */
import { useEffect, useState } from 'react'
import {
  Loader2, Package, Search, TrendingUp, TrendingDown,
} from 'lucide-react'

/* ─── StatCard ──────────────────────────────────────────────── */
export function StatCard({ label, value, icon: Icon, delta, deltaType = 'up', iconVariant = 'default', suffix = '', onClick, hint, secondary = false }) {
  const variantMap = {
    default: 'dx-stat-card__icon',
    green:   'dx-stat-card__icon dx-stat-card__icon--green',
    yellow:  'dx-stat-card__icon dx-stat-card__icon--yellow',
    red:     'dx-stat-card__icon dx-stat-card__icon--red',
    purple:  'dx-stat-card__icon dx-stat-card__icon--purple',
    orange:  'dx-stat-card__icon dx-stat-card__icon--orange',
  }

  const Tag = onClick ? 'button' : 'div'
  const cls = [
    'dx-stat-card',
    onClick    ? 'dx-stat-card--clickable' : '',
    secondary  ? 'dx-stat-card--secondary' : '',
  ].filter(Boolean).join(' ')

  return (
    <Tag
      className={cls}
      {...(onClick ? { type: 'button', onClick } : {})}
    >
      {Icon && (
        <div className={variantMap[iconVariant] ?? variantMap.default} aria-hidden>
          <Icon size={secondary ? 18 : 22} />
        </div>
      )}
      <div className="dx-stat-card__meta">
        <div className="dx-stat-card__label">{label}</div>
        <div className="dx-stat-card__value">{value}{suffix}</div>
        {delta && (
          <div className={`dx-kpi-delta dx-kpi-delta--${deltaType}`}>
            {deltaType === 'up' ? <TrendingUp size={11} style={{ display: 'inline', marginRight: 3 }} /> : <TrendingDown size={11} style={{ display: 'inline', marginRight: 3 }} />}
            {delta}
          </div>
        )}
        {hint && onClick && (
          <div className="dx-stat-card__hint">{hint} →</div>
        )}
      </div>
    </Tag>
  )
}

/* ─── StatusBadge ───────────────────────────────────────────── */
const BADGE_MAP = {
  // Job statuses
  pending:     'badge-dx badge-dx--pending',
  assigned:    'badge-dx badge-dx--dispatched',
  dispatched:  'badge-dx badge-dx--dispatched',
  in_progress: 'badge-dx badge-dx--enroute',
  en_route:    'badge-dx badge-dx--enroute',
  arrived:     'badge-dx badge-dx--arrived',
  completed:   'badge-dx badge-dx--completed',
  cancelled:   'badge-dx badge-dx--cancelled',
  delayed:     'badge-dx badge-dx--pending',
  // User/driver
  active:      'badge-dx badge-dx--user-active',
  inactive:    'badge-dx badge-dx--user-inactive',
  available:   'badge-dx badge-dx--available',
  busy:        'badge-dx badge-dx--dispatched',
  offline:     'badge-dx badge-dx--muted',
  in_use:      'badge-dx badge-dx--enroute',
  unavailable: 'badge-dx badge-dx--cancelled',
  maintenance: 'badge-dx badge-dx--maintenance',
  // OCR
  validated:    'badge-dx badge-dx--validated',
  failed:       'badge-dx badge-dx--failed',
  needs_review: 'badge-dx badge-dx--reviewing',
  processing:   'badge-dx badge-dx--dispatched',
  // misc
  new:          'badge-dx badge-dx--pending',
  read:         'badge-dx badge-dx--muted',
  converted:    'badge-dx badge-dx--completed',
}

const BADGE_LABELS = {
  pending: 'Pending',
  in_progress: 'En Route',
  en_route: 'En Route',
  assigned: 'Dispatched',
  dispatched: 'Dispatched',
  arrived: 'Arrived',
  completed: 'Completed',
  completed_with_pod: 'Completed',
  cancelled: 'Cancelled',
  delayed: 'Delayed',
  available: 'Available', needs_review: 'Flagged', validated: 'Validated',
  busy: 'On Duty',
}

export function StatusBadge({ status, label }) {
  const key = String(status || '').toLowerCase().replace(/ /g, '_')
  const cls = BADGE_MAP[key] ?? 'badge-dx badge-dx--muted'
  const txt = label ?? BADGE_LABELS[key] ?? (status ? String(status).replace(/_/g, ' ') : '—')
  return <span className={cls}>{txt}</span>
}

/* ─── PageHeader ────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <div className="header-stack">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="dx-action-row" style={{ margin: 0, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>}
    </header>
  )
}

/* ─── SectionCard ───────────────────────────────────────────── */
export function SectionCard({ title, children, action, className = '' }) {
  return (
    <div className={`dx-panel ${className}`} style={{ marginBottom: 0 }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h2 className="dx-panel-title" style={{ margin: 0 }}>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/* ─── EmptyState ────────────────────────────────────────────── */
export function EmptyState({ icon: Icon = Package, title = 'No records', message = '', action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
      <div className="dx-empty-illustration">
        <Icon size={30} />
      </div>
      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontSize: '1rem' }}>{title}</p>
      {message && <p style={{ fontSize: '0.875rem', maxWidth: 320, margin: '0 auto 20px' }}>{message}</p>}
      {action}
    </div>
  )
}

/* ─── LoadingRows ───────────────────────────────────────────── */
export function LoadingRows({ cols = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <div style={{ height: 14, borderRadius: 6, background: 'var(--slate-200)', width: j === 0 ? '80%' : '60%', animation: 'shimmer 1.4s infinite' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/* ─── LoadingSpinner ────────────────────────────────────────── */
export function LoadingSpinner({ size = 20, label = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: '0.875rem', padding: '24px 0' }}>
      <Loader2 size={size} style={{ animation: 'spin 0.7s linear infinite' }} />
      {label}
    </div>
  )
}

/* ─── SearchInput ───────────────────────────────────────────── */
export function SearchInput({ value, onChange, placeholder = 'Search…', style = {} }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)', width: '100%' }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--stroke)'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  )
}

/* ─── FilterSelect ──────────────────────────────────────────── */
export function FilterSelect({ value, onChange, options, label, style = {} }) {
  return (
    <label style={{ display: 'grid', gap: 5, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)', ...style }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '9px 12px', border: '1.5px solid var(--stroke)', borderRadius: 10, font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)', minWidth: 140 }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  )
}

/* ─── DataTable ─────────────────────────────────────────────── */
export function DataTable({ headers, children, loading, empty }) {
  return (
    <div className="dx-data-table-wrap">
      <table className="dx-data-table">
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {loading ? (
            <LoadingRows cols={headers.length} />
          ) : children || (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>{empty ?? 'No records.'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ─── PaginationBar ─────────────────────────────────────────── */
const PER_PAGE_OPTIONS_DEFAULT = [10, 25, 50, 100]

/**
 * Universal pagination footer.
 * Props:
 *   page, perPage, total — numbers
 *   onPage(n)            — called when user navigates to page n
 *   onPerPage(n)         — called when user changes rows-per-page
 *   perPageOptions       — array of integers (default [10, 25, 50, 100])
 */
export function PaginationBar({
  page, perPage, total, onPage, onPerPage,
  perPageOptions = PER_PAGE_OPTIONS_DEFAULT,
}) {
  const totalPages  = Math.max(1, Math.ceil(total / perPage))
  const from        = total === 0 ? 0 : (page - 1) * perPage + 1
  const to          = Math.min(page * perPage, total)
  const winStart    = Math.max(1, page - 2)
  const winEnd      = Math.min(totalPages, page + 2)
  const pageNums    = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i)

  return (
    <div className="dx-pagination-bar">
      {/* Per-page selector */}
      <div className="dx-pagination-bar__perpage">
        <span className="dx-pagination-bar__label">Rows per page:</span>
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className="dx-pagination-bar__pp-select"
        >
          {perPageOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Showing X–Y of Z */}
      <span className="dx-pagination-bar__info">
        {total === 0
          ? 'No records'
          : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
      </span>

      {/* Page navigation */}
      {totalPages > 1 && (
        <nav className="dx-pagination-bar__nav" aria-label="Page navigation">
          <button type="button" className="dx-pager__btn" disabled={page <= 1} onClick={() => onPage(1)} title="First page" aria-label="First page">«</button>
          <button type="button" className="dx-pager__btn" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page" aria-label="Previous page">‹</button>
          {winStart > 1 && <span className="dx-pagination-bar__ellipsis">…</span>}
          {pageNums.map((p) => (
            <button
              key={p}
              type="button"
              className={`dx-pager__btn${p === page ? ' dx-pager__btn--active' : ''}`}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          {winEnd < totalPages && <span className="dx-pagination-bar__ellipsis">…</span>}
          <button type="button" className="dx-pager__btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Next page" aria-label="Next page">›</button>
          <button type="button" className="dx-pager__btn" disabled={page >= totalPages} onClick={() => onPage(totalPages)} title="Last page" aria-label="Last page">»</button>
        </nav>
      )}
    </div>
  )
}

/* ─── ProofImageModal ───────────────────────────────────────── */
/**
 * Fetches and displays an authenticated proof image in a modal.
 *
 * Props:
 *   documentId  — delivery_documents.id to fetch
 *   title       — modal heading (default: "En Route Proof")
 *   onClose     — called when user dismisses the modal
 */
export function ProofImageModal({ documentId, title = 'En Route Proof', onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!documentId) return
    let active = true
    let objectUrl = null
    const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:8000/api'
    const token = localStorage.getItem('deliverex_token')

    setLoading(true)
    setError('')
    setBlobUrl(null)

    fetch(`${apiBase}/documents/${documentId}/file`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'image/*,*/*',
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Proof image not found.' : `Could not load proof image (${res.status}).`)
        return res.blob()
      })
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Proof image not found.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [documentId])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!documentId) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,23,42,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card, #fff)', borderRadius: 14, overflow: 'hidden',
          maxWidth: 720, width: '100%', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--stroke, #e2e8f0)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted, #64748b)', fontSize: '1.125rem', lineHeight: 1, padding: '4px 6px', borderRadius: 6 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 220 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--muted, #64748b)' }}>
              <Loader2 size={32} style={{ animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: '0.875rem' }}>Loading proof image…</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', color: 'var(--danger, #dc2626)', fontSize: '0.875rem', padding: '16px 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🖼️</div>
              {error}
            </div>
          ) : (
            <img
              src={blobUrl}
              alt="En Route Proof"
              style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: 8, objectFit: 'contain', display: 'block' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── FormField ─────────────────────────────────────────────── */
export function FormField({ label, error, children, required, hint }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>}</label>
      {children}
      {hint  && <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 4 }}>{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

/* ─── Animations (inject once) ──────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('dx-ui-animations')) {
  const style = document.createElement('style')
  style.id = 'dx-ui-animations'
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  `
  document.head.appendChild(style)
}
