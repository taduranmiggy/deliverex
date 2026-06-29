import { SkeletonBlock } from './ui'

/**
 * Standard Suspense fallback shown while a lazily-loaded route chunk downloads.
 */
function RouteFallback({ label = 'Loading page…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="dx-route-fallback"
      style={{ padding: '32px 24px', maxWidth: 480, margin: '0 auto' }}
    >
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 16 }}>{label}</p>
      <SkeletonBlock lines={4} gap={12} />
    </div>
  )
}

export default RouteFallback
