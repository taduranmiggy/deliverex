import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import useReducedMotion from '../../hooks/useReducedMotion'
import { slideCrossfade, withReducedMotion } from '../../motion/motion'

const DEFAULT_SLIDES = [
  {
    title: 'Connect dispatch, drivers, and customers.',
    subtitle: 'Everything you need to run deliveries in one clear, customizable workflow.',
  },
  {
    title: 'Proof and tracking you can rely on.',
    subtitle: 'ETAs, status updates, and delivery documents when your team needs them.',
  },
  {
    title: 'Built for field and office teams alike.',
    subtitle: 'Managers, dispatchers, and drivers stay aligned—without noisy handoffs.',
  },
]

function AsideArt() {
  return (
    <svg className="auth-split-art" viewBox="0 0 360 240" role="img" aria-labelledby="aside-art-title">
      <title id="aside-art-title">Stylized connections between fleet apps and Deliverex dashboard</title>
      <defs>
        <linearGradient id="authArtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.75)" />
        </linearGradient>
      </defs>
      <circle cx="180" cy="120" r="118" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
      <circle cx="180" cy="120" r="88" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <g fill="url(#authArtGrad)">
        <circle cx="72" cy="88" r="22" opacity="0.95" />
        <circle cx="56" cy="158" r="18" opacity="0.88" />
        <circle cx="108" cy="172" r="16" opacity="0.82" />
      </g>
      <path
        d="M94 92 L168 104 M78 154 L174 126 M118 164 L178 134"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="178" y="72" width="132" height="96" rx="10" fill="rgba(255,255,255,0.92)" />
      <rect x="194" y="88" width="56" height="8" rx="2" fill="#2d54b7" opacity="0.85" />
      <rect x="194" y="104" width="100" height="6" rx="2" fill="#94a3b8" opacity="0.55" />
      <rect x="194" y="118" width="76" height="6" rx="2" fill="#94a3b8" opacity="0.4" />
      <rect x="194" y="136" width="48" height="22" rx="4" fill="#2d54b7" opacity="0.2" />
    </svg>
  )
}

function AuthMarketingAside({ slides = DEFAULT_SLIDES, intervalMs = 6200 }) {
  const reduced = useReducedMotion()
  const [slide, setSlide] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (slides.length <= 1) return undefined
    const t = window.setInterval(() => {
      setDirection(1)
      setSlide((s) => (s + 1) % slides.length)
    }, intervalMs)
    return () => window.clearInterval(t)
  }, [slides.length, intervalMs])

  const goToSlide = (i) => {
    setDirection(i > slide ? 1 : -1)
    setSlide(i)
  }

  const current = slides[slide] ?? slides[0]
  const variants = withReducedMotion(reduced, slideCrossfade)

  return (
    <aside className="auth-split-aside-col" aria-label="Deliverex highlights">
      <div className="auth-split-aside-pattern" aria-hidden />
      <div className="auth-split-aside-content">
        <AsideArt />
        <div className="auth-aside-copy" style={{ position: 'relative', minHeight: '5.5rem' }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <h2 className="auth-aside-title">{current.title}</h2>
              <p className="auth-aside-sub">{current.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        {slides.length > 1 ? (
          <div className="auth-aside-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`auth-aside-dot${i === slide ? ' auth-aside-dot--active' : ''}`}
                aria-label={`Slide ${i + 1}${i === slide ? ', current' : ''}`}
                aria-current={i === slide ? 'true' : undefined}
                onClick={() => goToSlide(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

export default AuthMarketingAside
