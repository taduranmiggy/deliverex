import { useEffect } from 'react'

function BottomSheet({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="da-sheet-backdrop" role="presentation" onClick={onClose} />
      <div className="da-sheet" role="dialog" aria-modal="true" aria-labelledby="da-sheet-title">
        <div className="da-sheet__handle" aria-hidden />
        {title && <h2 id="da-sheet-title" className="da-sheet__title">{title}</h2>}
        {subtitle && <p className="da-sheet__sub">{subtitle}</p>}
        {children}
        {footer && <div className="da-sheet__actions">{footer}</div>}
      </div>
    </>
  )
}

export default BottomSheet
