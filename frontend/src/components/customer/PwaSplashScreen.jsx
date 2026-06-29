import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isStandalonePwa } from '../../utils/pwaUtils'

const SPLASH_KEY = 'deliverex_pwa_splash_shown'
const MIN_SPLASH_MS = 1200
const MAX_SPLASH_MS = 4500
const FAVICON_SRC = '/favicon-192x192.png?v=2'

function PwaSplashScreen() {
  const [showSplash, setShowSplash] = useState(() => {
    if (!isStandalonePwa()) return false
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [appReady, setAppReady] = useState(false)
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

  const tryDismiss = useCallback(() => {
    if (!showSplash || finishedRef.current || !appReady) return
    const elapsed = Date.now() - shownAtRef.current
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed)
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = window.setTimeout(finishSplash, wait)
  }, [showSplash, appReady, finishSplash])

  useEffect(() => {
    if (!showSplash) return undefined

    shownAtRef.current = Date.now()
    finishedRef.current = false

    const hardCap = window.setTimeout(finishSplash, MAX_SPLASH_MS)

    const onAppReady = () => setAppReady(true)
    window.addEventListener('deliverex:app-ready', onAppReady)
    if (document.querySelector('.customer-layout--pwa, .pwa-home')) {
      setAppReady(true)
    }

    const readyFallback = window.setTimeout(() => setAppReady(true), 2500)

    return () => {
      window.removeEventListener('deliverex:app-ready', onAppReady)
      window.clearTimeout(hardCap)
      window.clearTimeout(readyFallback)
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current)
    }
  }, [showSplash, finishSplash])

  useEffect(() => {
    tryDismiss()
  }, [tryDismiss, appReady])

  if (!showSplash) return null

  const splash = (
    <div className="pwa-splash" role="presentation" aria-busy="true" aria-label="Loading Deliverex">
      <div className="pwa-splash__content">
        <div className="pwa-splash__logo-stage">
          <img
            src={FAVICON_SRC}
            alt=""
            className="pwa-splash__logo-fallback pwa-splash__logo-fallback--visible pwa-splash__logo-animate"
            aria-hidden
          />
        </div>
        <p className="pwa-splash__title">Deliverex</p>
      </div>
    </div>
  )

  return createPortal(splash, document.body)
}

export default PwaSplashScreen
