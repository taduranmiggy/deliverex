import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

const variants = {
  initial: { opacity: 1, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: -6 },
}

function PageTransition({ children, style }) {
  const { pathname } = useLocation()

  return (
    <motion.div
      key={pathname}
      className="dx-page-enter"
      style={style}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
