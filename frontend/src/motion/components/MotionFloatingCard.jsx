import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { floatCard, withReducedMotion } from '../motion'

function MotionFloatingCard({ children, className, style, index = 0 }) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={`motion-floating-card motion-card-shadow${className ? ` ${className}` : ''}`}
      style={style}
      custom={index}
      initial="hidden"
      animate={reduced ? 'visible' : ['visible', 'float']}
      variants={withReducedMotion(reduced, floatCard)}
    >
      {children}
    </motion.div>
  )
}

export default MotionFloatingCard
