import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { iconHover, withReducedMotion } from '../motion'

function MotionIcon({ children, className, style }) {
  const reduced = useReducedMotion()

  return (
    <motion.span
      className={className}
      style={{ display: 'inline-flex', ...style }}
      variants={withReducedMotion(reduced, iconHover)}
      initial="rest"
      whileHover={reduced ? undefined : 'hover'}
    >
      {children}
    </motion.span>
  )
}

export default MotionIcon
