import { useCallback, useEffect, useRef, useState } from 'react'
import Lottie from 'lottie-react'
import { isStandalonePwa } from '../../utils/pwaUtils'

const SPLASH_KEY = 'deliverex_pwa_splash_shown'
const MIN_SPLASH_MS = 1400
const MAX_SPLASH_MS = 3000
const FAVICON_SRC = '/favicon-192x192.png?v=2'

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
  const [useFallback, setUseFallback] = useState(false)
  const shownAtRef = useRef(0)
  const finishedRef = useRef(false)
  const dismissTimerRef = useRef(null)

  const finishSplash = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    try {
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowSplash(false)
  }, [])

  const scheduleDismiss = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed)
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = window.setTimeout(finishSplash, wait)
  }, [finishSplash])

  useEffect(() => {
    if (!showSplash) return undefined

    shownAtRef.current = Date.now()
    finishedRef.current = false

    const hardCap = window.setTimeout(finishSplash, MAX_SPLASH_MS)

    if (prefersReducedMotion()) {
      setUseFallback(true)
      scheduleDismiss()
      return () => {
        window.clearTimeout(hardCap)
        if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current)
      }
    }

    let cancelled = false
    import('../../assets/deliverex-splash.json')
      .then((mod) => {
        if (!cancelled) setAnimationData(mod.default ?? mod)
      })
      .catch(() => {
        if (!cancelled) {
          setUseFallback(true)
          scheduleDismiss()
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(hardCap)
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current)
    }
  }, [showSplash, finishSplash, scheduleDismiss])

  const handleLottieComplete = useCallback(() => {
    scheduleDismiss()
  }, [scheduleDismiss])

  const handleLottieDataFailed = useCallback(() => {
    setUseFallback(true)
    scheduleDismiss()
  }, [scheduleDismiss])

  return (
    <>
      {showSplash ? (
        <div className="pwa-splash" role="presentation" aria-busy="true" aria-label="Loading Deliverex">
          <div className="pwa-splash__content">
            <div className="pwa-splash__logo-stage">
              <img
                src={FAVICON_SRC}
                alt=""
                className={`pwa-splash__logo-fallback${useFallback || !animationData ? ' pwa-splash__logo-fallback--visible' : ''}`}
                aria-hidden
              />
              {animationData && !useFallback ? (
                <Lottie
                  animationData={animationData}
                  loop={false}
                  autoplay
                  onComplete={handleLottieComplete}
                  onDataFailed={handleLottieDataFailed}
                  onLoopComplete={handleLottieComplete}
                  className="pwa-splash__lottie"
                  aria-hidden
                />
              ) : null}
            </div>
            <p className="pwa-splash__title">Deliverex</p>
          </div>
        </div>
      ) : null}
      {children}
    </>
  )
}

export default PwaSplashScreen
