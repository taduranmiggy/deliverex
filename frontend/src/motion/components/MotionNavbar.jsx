import { motion } from 'framer-motion'
import useReducedMotion from '../../hooks/useReducedMotion'
import useScrollNavbar from '../../hooks/useScrollNavbar'
import { navbarEnter, navItem, stagger, withReducedMotion } from '../motion'

function MotionNavbar({ children, className, logo, navItems, actions }) {
  const reduced = useReducedMotion()
  const scrolled = useScrollNavbar(50)

  return (
    <motion.nav
      className={`${className ?? ''}${scrolled ? ' motion-navbar--scrolled' : ''}`.trim()}
      role="navigation"
      aria-label="Site navigation"
      initial="hidden"
      animate="visible"
      variants={withReducedMotion(reduced, navbarEnter)}
    >
      <div className="customer-nav-inner">
        {logo && (
          <motion.div variants={withReducedMotion(reduced, navbarEnter)}>
            {logo}
          </motion.div>
        )}

        {navItems && (
          <motion.div
            className="customer-nav-links customer-nav-links--desktop"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: reduced ? 0 : stagger.nav, delayChildren: 0.12 },
              },
            }}
          >
            {navItems.map((item, i) => (
              <motion.div key={item.key ?? i} custom={i} variants={withReducedMotion(reduced, navItem)}>
                {item.node}
              </motion.div>
            ))}
          </motion.div>
        )}

        {actions && (
          <motion.div
            custom={navItems?.length ?? 0}
            variants={withReducedMotion(reduced, navItem)}
          >
            {actions}
          </motion.div>
        )}

        {children}
      </div>
    </motion.nav>
  )
}

export default MotionNavbar
