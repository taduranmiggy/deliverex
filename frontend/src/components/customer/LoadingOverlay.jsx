import { Loader2 } from 'lucide-react'

function LoadingOverlay({ open, message = 'Loading...', submessage = 'Please wait.' }) {
  if (!open) return null

  return (
    <div className="pwa-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="pwa-loading-overlay__card">
        <Loader2 size={32} className="pwa-loading-overlay__spinner" aria-hidden />
        <p className="pwa-loading-overlay__message">{message}</p>
        {submessage ? <p className="pwa-loading-overlay__sub">{submessage}</p> : null}
      </div>
    </div>
  )
}

export default LoadingOverlay
