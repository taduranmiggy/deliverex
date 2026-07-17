import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (event) => setReduced(event.matches)
    mq.addEventListener('change', onChange)
    setReduced(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
