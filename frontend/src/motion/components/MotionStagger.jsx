import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { heroChild, stagger, withReducedMotion } from '../motion'

function MotionStagger({ children, className, style, delayChildren = 0 }) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : stagger.hero,
            delayChildren: reduced ? 0 : delayChildren,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

function MotionStaggerItem({ children, className, style, index = 0, as: Tag = motion.div }) {
  const reduced = useReducedMotion()
  const Component = Tag

  return (
    <Component
      className={className}
      style={style}
      custom={index}
      variants={withReducedMotion(reduced, heroChild)}
    >
      {children}
    </Component>
  )
}

export { MotionStagger, MotionStaggerItem }
