import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import useReducedMotion from '../../hooks/useReducedMotion'

function MotionParallax({ children, className, style, offset = 12 }) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -offset])

  return (
    <motion.div ref={ref} className={className} style={{ ...style, y: reduced ? 0 : y }}>
      {children}
    </motion.div>
  )
}

export default MotionParallax
