import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import useReducedMotion from '../../hooks/useReducedMotion'
import { bgGrid, easing, withReducedMotion } from '../motion'

function MotionBackground({ className, variant = 'hero' }) {
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className={`motion-bg motion-bg--${variant}${className ? ` ${className}` : ''}`} aria-hidden>
      <motion.div
        className="motion-bg-gradient"
        animate={reduced ? undefined : {
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={reduced ? undefined : {
          duration: 24,
          repeat: Infinity,
          ease: easing.easeInOut,
        }}
      />
      <motion.div
        className="motion-bg-grid"
        initial="hidden"
        animate="visible"
        variants={withReducedMotion(reduced, bgGrid)}
      />
      <div className="motion-bg-glow" />
      {mounted && !reduced && (
        <>
          <motion.div
            className="motion-bg-blob motion-bg-blob--1"
            animate={{ x: [0, 12, 0], y: [0, -8, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: easing.easeInOut }}
          />
          <motion.div
            className="motion-bg-blob motion-bg-blob--2"
            animate={{ x: [0, -10, 0], y: [0, 10, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: easing.easeInOut }}
          />
        </>
      )}
    </div>
  )
}

export default MotionBackground
