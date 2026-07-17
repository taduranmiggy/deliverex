import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import { duration, easing, fadeUp, instantTransition, viewportOnce, withReducedMotion } from '../motion'

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.section, ease: easing.easeOut },
  },
}

const MOTION_TAGS = {
  section: motion.section,
  div: motion.div,
  article: motion.article,
  main: motion.main,
}

function MotionSection({ children, className, style, as = 'section', variant = 'fadeUp' }) {
  const reduced = useReducedMotion()
  const Component = MOTION_TAGS[as] || motion.section
  const variants = variant === 'fade' ? fadeIn : fadeUp

  return (
    <Component
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={withReducedMotion(reduced, variants)}
      transition={instantTransition(reduced)}
    >
      {children}
    </Component>
  )
}

export default MotionSection
