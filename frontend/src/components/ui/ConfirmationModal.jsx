import { useEffect, useId, useRef } from 'react'
import {
  AlertTriangle, Archive, Loader2, LogOut, RotateCcw, Trash2, X,
} from 'lucide-react'

const VARIANT_DEFAULTS = {
  danger: { Icon: Trash2, confirmClass: 'btn-dx-danger', tone: 'danger' },
  warning: { Icon: AlertTriangle, confirmClass: 'btn-dx-primary', tone: 'warning' },
  archive: { Icon: Archive, confirmClass: 'btn-dx-primary', tone: 'archive' },
  restore: { Icon: RotateCcw, confirmClass: 'btn-dx-primary', tone: 'restore' },
  deactivate: { Icon: AlertTriangle, confirmClass: 'btn-dx-primary', tone: 'warning' },
  reject: { Icon: AlertTriangle, confirmClass: 'btn-dx-danger', tone: 'danger' },
  logout: { Icon: LogOut, confirmClass: 'btn-dx-danger', tone: 'danger' },
  primary: { Icon: AlertTriangle, confirmClass: 'btn-dx-primary', tone: 'primary' },
}

/**
 * Shared Deliverex confirmation modal — replaces browser confirm() dialogs.
 */
export function ConfirmationModal({
  open,
  title,
  message,
  detail,
  icon: IconProp,
  variant = 'primary',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  loadingLabel,
  returnFocusRef,
  onConfirm,
  onCancel,
}) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const returnFocusTargetRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    returnFocusTargetRef.current = returnFocusRef?.current ?? document.activeElement
    document.body.classList.add('dx-nav-locked')
    requestAnimationFrame(() => cancelRef.current?.focus())

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const items = [...focusable]
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('dx-nav-locked')
      const target = returnFocusRef?.current ?? returnFocusTargetRef.current
      if (target && typeof target.focus === 'function') {
        target.focus()
      }
    }
  }, [open, loading, onCancel, returnFocusRef])

  if (!open) return null

  const preset = VARIANT_DEFAULTS[variant] ?? VARIANT_DEFAULTS.primary
  const Icon = IconProp ?? preset.Icon
  const busyLabel = loadingLabel ?? confirmLabel

  return (
    <div
      className="dx-modal-backdrop"
      onClick={loading ? undefined : onCancel}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="dx-modal dx-confirm-modal"
        style={{ maxWidth: 460 }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dx-confirm-modal__header">
          <div className={`dx-confirm-modal__icon dx-confirm-modal__icon--${preset.tone}`} aria-hidden>
            <Icon size={22} />
          </div>
          <button
            type="button"
            className="dx-modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="dx-confirm-modal__body">
          <h2 id={titleId} className="dx-confirm-modal__title">{title}</h2>
          <p id={descId} className="dx-confirm-modal__message">{message}</p>
          {detail && <p className="dx-confirm-modal__detail">{detail}</p>}
        </div>

        <div className="dx-confirm-modal__footer">
          <button
            ref={cancelRef}
            type="button"
            className="btn-dx-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={preset.confirmClass}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Loader2 size={16} className="dx-confirm-modal__spinner" aria-hidden />}
            {loading ? `${busyLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
