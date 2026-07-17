import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { imageReveal, instantTransition, viewportOnce, withReducedMotion } from '../motion'

function MotionImage({ children, className, style, as: Tag = motion.div }) {
  const reduced = useReducedMotion()
  const Component = Tag

  return (
    <Component
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={withReducedMotion(reduced, imageReveal)}
      transition={instantTransition(reduced)}
    >
      {children}
    </Component>
  )
}

export default MotionImage
