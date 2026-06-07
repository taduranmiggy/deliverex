import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Wraps page content to replay a CSS entrance animation on every route change.
 *
 * Technique: on location.key change, remove the animation class, force a
 * reflow (one frame), then re-add it. The CSS animation replays without
 * unmounting / remounting child components (no data-fetch side effects).
 *
 * The animation itself is defined in deliverex-ui.css → .dx-page-enter
 * and is ~200 ms — imperceptible as a "restart".
 *
 * prefers-reduced-motion is handled entirely by CSS:
 * @media (prefers-reduced-motion: reduce) { .dx-page-enter { animation: none } }
 */
function PageTransition({ children, style }) {
  const ref = useRef(null)
  const { key } = useLocation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.remove('dx-page-enter')
    void el.offsetHeight          // force reflow — triggers animation restart
    el.classList.add('dx-page-enter')
  }, [key])

  return (
    <div ref={ref} className="dx-page-enter" style={style}>
      {children}
    </div>
  )
}

export default PageTransition
