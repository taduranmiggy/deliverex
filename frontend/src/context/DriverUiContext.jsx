import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const DriverUiContext = createContext(null)

export function DriverUiProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant, id: Date.now() })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <DriverUiContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`da-toast da-toast--${toast.variant}`} role="status">
          {toast.message}
        </div>
      )}
    </DriverUiContext.Provider>
  )
}

export function useDriverUi() {
  const ctx = useContext(DriverUiContext)
  if (!ctx) throw new Error('useDriverUi must be used within DriverUiProvider')
  return ctx
}
