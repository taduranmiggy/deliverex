import { motion } from 'framer-motion'
import { CheckCircle2, Clock, MapPin, Truck } from 'lucide-react'
import useReducedMotion from '../../hooks/useReducedMotion'
import { easing } from '../../motion/motion'
import './landing-hero-scene.css'

const OVERVIEW_STATS = [
  { Icon: Clock, label: 'Estimated Arrival', value: '14 min', hint: '2.4 km to destination' },
  { Icon: Truck, label: 'Delivery Status', value: 'In Transit', hint: 'Route optimized' },
  { Icon: MapPin, label: 'Tracking ID', value: 'XKFP2NQRLA', hint: 'ABC-1234 · Juan Dela Cruz' },
  { Icon: CheckCircle2, label: 'Proof of Delivery', value: 'Verified', hint: 'QR confirmed on site' },
]

function LandingHeroScene() {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="hero-preview"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easing.easeOut, delay: 0.15 }}
      aria-label="Sample delivery overview"
    >
      <div className="hero-preview__header">
        <span className="hero-preview__live" aria-hidden />
        <span className="hero-preview__title">Live Delivery Overview</span>
        <span className="hero-preview__badge">Sample</span>
      </div>

      <div className="hero-preview__grid">
        {OVERVIEW_STATS.map(({ Icon, label, value, hint }) => (
          <article key={label} className="hero-preview__stat">
            <div className="hero-preview__icon-wrap" aria-hidden>
              <Icon size={17} />
            </div>
            <div className="hero-preview__stat-body">
              <p className="hero-preview__stat-label">{label}</p>
              <p className="hero-preview__stat-value">{value}</p>
              <p className="hero-preview__stat-hint">{hint}</p>
            </div>
          </article>
        ))}
      </div>
    </motion.div>
  )
}

export default LandingHeroScene
