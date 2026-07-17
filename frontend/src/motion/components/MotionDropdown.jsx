import { AnimatePresence, motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { dropdown, withReducedMotion } from '../motion'

function MotionDropdown({ open, children, className }) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={className}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={withReducedMotion(reduced, dropdown)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MotionDropdown
