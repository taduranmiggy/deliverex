import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Lottie from 'lottie-react'
import { isStandalonePwa } from '../../utils/pwaUtils'

const SPLASH_KEY = 'deliverex_pwa_splash_shown'
const MIN_SPLASH_MS = 1200
const REDUCED_MOTION_SPLASH_MS = 600
const FAVICON_SRC = '/favicon-192x192.png?v=2'
const LOTTIE_SRC = '/lottie/deliverex-splash.json'

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function PwaSplashScreen({ children }) {
  const [showSplash, setShowSplash] = useState(() => {
    if (!isStandalonePwa()) return false
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [animationData, setAnimationData] = useState(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const shownAtRef = useRef(0)
  const dismissTimerRef = useRef(null)

  const finishSplash = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowSplash(false)
  }, [])

  const scheduleDismiss = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current
    const minMs = reducedMotion ? REDUCED_MOTION_SPLASH_MS : MIN_SPLASH_MS
    const wait = Math.max(0, minMs - elapsed)
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(finishSplash, wait)
  }, [finishSplash, reducedMotion])

  useEffect(() => {
    if (!showSplash) return undefined
    shownAtRef.current = Date.now()
    const reduced = prefersReducedMotion()
    setReducedMotion(reduced)

    if (reduced) {
      scheduleDismiss()
      return () => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      }
    }

    let cancelled = false
    fetch(LOTTIE_SRC)
      .then((res) => {
        if (!res.ok) throw new Error('Lottie load failed')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data)
      })
      .catch(() => {
        if (!cancelled) scheduleDismiss()
      })

    const safetyTimer = setTimeout(() => {
      if (!cancelled) scheduleDismiss()
    }, 2800)

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [showSplash, scheduleDismiss])

  const handleLottieComplete = useCallback(() => {
    scheduleDismiss()
  }, [scheduleDismiss])

  return (
    <>
      <AnimatePresence>
        {showSplash ? (
          <motion.div
            className="pwa-splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            aria-hidden={!showSplash}
            role="presentation"
          >
            <div className="pwa-splash__content">
              {reducedMotion || !animationData ? (
                <motion.img
                  src={FAVICON_SRC}
                  alt=""
                  className="pwa-splash__logo-fallback"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : (
                <Lottie
                  animationData={animationData}
                  loop={false}
                  autoplay
                  onComplete={handleLottieComplete}
                  className="pwa-splash__lottie"
                  aria-hidden
                />
              )}
              <motion.p
                className="pwa-splash__title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: reducedMotion ? 0.1 : 0.35 }}
              >
                Deliverex
              </motion.p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children}
    </>
  )
}

export default PwaSplashScreen
