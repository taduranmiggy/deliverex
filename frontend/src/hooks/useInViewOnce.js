import { useEffect, useRef, useState } from 'react'

/**
 * Lightweight Intersection Observer hook for one-shot viewport detection.
 * @param {IntersectionObserverInit} [options]
 */
export default function useInViewOnce(options = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '-80px', ...options },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [inView, options])

  return { ref, inView }
}
