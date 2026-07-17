import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import useReducedMotion from '../../hooks/useReducedMotion'
import { modalBackdrop, modalContent, withReducedMotion } from '../motion'

function MotionModal({ open, onClose, children, className, labelledBy }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dx-modal-backdrop motion-modal-backdrop"
          role="presentation"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={withReducedMotion(reduced, modalBackdrop)}
          onClick={onClose}
        >
          <motion.div
            className={`dx-modal motion-modal-content${className ? ` ${className}` : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={withReducedMotion(reduced, modalContent)}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MotionModal
