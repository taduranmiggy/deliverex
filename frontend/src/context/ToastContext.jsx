import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':    return [...state, action.toast]
    case 'REMOVE': return state.filter((t) => t.id !== action.id)
    default:       return state
  }
}

function ToastItem({ id, message, variant, onDismiss }) {
  const Icon = ICONS[variant] ?? Info
  return (
    <div className={`dx-toast dx-toast--${variant}`} role="status" aria-live="polite">
      <Icon size={16} className="dx-toast__icon" aria-hidden />
      <span className="dx-toast__msg">{message}</span>
      <button
        type="button"
        className="dx-toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])
  const counterRef = useRef(0)

  const toast = useCallback((message, variant = 'success', duration = 4500) => {
    const id = ++counterRef.current
    dispatch({ type: 'ADD', toast: { id, message, variant } })
    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration)
    }
  }, [])

  const dismiss = useCallback((id) => {
    dispatch({ type: 'REMOVE', id })
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="dx-toast-container" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            {...t}
            onDismiss={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
