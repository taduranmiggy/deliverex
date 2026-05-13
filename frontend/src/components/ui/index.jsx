/**
 * Deliverex Shared UI Components
 * Use these across all roles for visual consistency.
 */
import {
  AlertCircle, CheckCircle2, Clock, Loader2, Package,
  Search, TrendingUp, TrendingDown, XCircle,
} from 'lucide-react'

/* ─── StatCard ──────────────────────────────────────────────── */
export function StatCard({ label, value, icon: Icon, delta, deltaType = 'up', iconVariant = 'default', suffix = '' }) {
  const variantMap = {
    default: 'dx-stat-card__icon',
    green:   'dx-stat-card__icon dx-stat-card__icon--green',
    yellow:  'dx-stat-card__icon dx-stat-card__icon--yellow',
    red:     'dx-stat-card__icon dx-stat-card__icon--red',
    purple:  'dx-stat-card__icon dx-stat-card__icon--purple',
    orange:  'dx-stat-card__icon dx-stat-card__icon--orange',
  }

  return (
    <div className="dx-stat-card">
      {Icon && (
        <div className={variantMap[iconVariant] ?? variantMap.default} aria-hidden>
          <Icon size={22} />
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
      </div>
    </div>
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
  // User/driver
  active:      'badge-dx badge-dx--user-active',
  inactive:    'badge-dx badge-dx--user-inactive',
  available:   'badge-dx badge-dx--available',
  busy:        'badge-dx badge-dx--dispatched',
  offline:     'badge-dx badge-dx--muted',
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
  in_progress: 'En Route', assigned: 'Dispatched', dispatched: 'Dispatched',
  available: 'Available', needs_review: 'Flagged', validated: 'Validated',
  busy: 'On Duty',
}

export function StatusBadge({ status, label }) {
  const cls = BADGE_MAP[status] ?? 'badge-dx badge-dx--muted'
  const txt = label ?? BADGE_LABELS[status] ?? (status ? String(status).replace(/_/g, ' ') : '—')
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
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--slate-100)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
        <Icon size={28} style={{ opacity: 0.4 }} />
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
