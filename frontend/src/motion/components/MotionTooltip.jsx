import { AnimatePresence, motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { tooltip, withReducedMotion } from '../motion'

function MotionTooltip({ show, children, className }) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`motion-tooltip${className ? ` ${className}` : ''}`}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={withReducedMotion(reduced, tooltip)}
          role="tooltip"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MotionTooltip
