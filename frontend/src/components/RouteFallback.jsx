import { Loader2 } from 'lucide-react'

/**
 * Standard Suspense fallback shown while a lazily-loaded route chunk downloads.
 *
 * Intentionally lightweight and unobtrusive — it preserves layout chrome
 * (the surrounding shell stays mounted) and only fills the content outlet.
 */
function RouteFallback({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 240,
        color: 'var(--muted, #64748b)',
        fontSize: '0.875rem',
      }}
    >
      <Loader2 size={20} style={{ animation: 'spin 0.7s linear infinite' }} />
      {label}
    </div>
  )
}

export default RouteFallback
