import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { floatY, heroImage, withReducedMotion } from '../motion'

function MotionHeroVisual({ children, className, style }) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
      variants={withReducedMotion(reduced, heroImage)}
    >
      <motion.div
        variants={reduced ? undefined : floatY}
        animate={reduced ? undefined : 'animate'}
        style={{ willChange: reduced ? undefined : 'transform' }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export default MotionHeroVisual
