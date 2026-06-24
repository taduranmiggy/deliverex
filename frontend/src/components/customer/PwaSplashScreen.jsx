import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck } from 'lucide-react'
import { isStandalonePwa } from '../../utils/pwaUtils'

const SPLASH_KEY = 'deliverex_pwa_splash_shown'

function PwaSplashScreen({ children }) {
  const [showSplash, setShowSplash] = useState(() => {
    if (!isStandalonePwa()) return false
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!showSplash) return undefined
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_KEY, '1')
      } catch {
        /* ignore */
      }
      setShowSplash(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [showSplash])

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            className="pwa-splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-hidden={!showSplash}
          >
            <motion.div
              className="pwa-splash__logo"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              <Truck size={40} color="#fff" strokeWidth={2.25} />
            </motion.div>
            <motion.p
              className="pwa-splash__title"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              Deliverex
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  )
}

export default PwaSplashScreen
