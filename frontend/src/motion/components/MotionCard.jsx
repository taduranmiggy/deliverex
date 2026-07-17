import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { cardEnter, instantTransition, viewportOnce, withReducedMotion } from '../motion'

function MotionCard({
  children,
  className,
  style,
  index = 0,
  hover = true,
  as: Tag = motion.div,
}) {
  const reduced = useReducedMotion()
  const Component = Tag

  return (
    <Component
      className={`motion-card-shadow${className ? ` ${className}` : ''}`}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={withReducedMotion(reduced, cardEnter)}
      custom={index}
      transition={instantTransition(reduced)}
      whileHover={hover && !reduced ? { y: -6, scale: 1.02, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } : undefined}
    >
      {children}
    </Component>
  )
}

export default MotionCard
