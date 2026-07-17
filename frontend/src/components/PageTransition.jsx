import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import useReducedMotion from '../hooks/useReducedMotion'
import { routeEnter, routeExit, withReducedMotion } from '../motion/motion'

function PageTransition({ children, style, motion: useMotion = false }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()

  if (!useMotion) {
    return (
      <div className="dx-page-enter" style={style}>
        {children}
      </div>
    )
  }

  const variants = {
    hidden: withReducedMotion(reduced, routeEnter).hidden,
    visible: withReducedMotion(reduced, routeEnter).visible,
    exit: withReducedMotion(reduced, routeExit).exit,
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="motion-page-transition"
        style={style}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export default PageTransition
