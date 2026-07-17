import { animate, useInView, useMotionValue, useMotionValueEvent } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import useReducedMotion from '../../hooks/useReducedMotion'
import { duration, easing } from '../motion'

function MotionCounter({ value, className, style, suffix = '', prefix = '', decimals = 0 }) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const motionValue = useMotionValue(0)
  const [text, setText] = useState(`${prefix}0${suffix}`)

  useMotionValueEvent(motionValue, 'change', (v) => {
    const formatted = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
    setText(`${prefix}${formatted}${suffix}`)
  })

  useEffect(() => {
    if (!inView) return undefined
    if (reduced) {
      motionValue.set(value)
      return undefined
    }
    const controls = animate(motionValue, value, {
      duration: duration.slow,
      ease: easing.easeOut,
    })
    return () => controls.stop()
  }, [inView, motionValue, reduced, value])

  return (
    <span ref={ref} className={className} style={style}>
      {text}
    </span>
  )
}

export default MotionCounter
