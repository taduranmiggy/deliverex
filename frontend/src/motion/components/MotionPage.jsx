import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { instantTransition, pageEnter, withReducedMotion } from '../motion'

function MotionPage({ children, className, style, as: Tag = motion.div }) {
  const reduced = useReducedMotion()
  const Component = Tag

  return (
    <Component
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
      variants={withReducedMotion(reduced, pageEnter)}
      transition={instantTransition(reduced)}
    >
      {children}
    </Component>
  )
}

export default MotionPage
