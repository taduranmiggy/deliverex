import { motion } from 'framer-motion'
import {
  CheckCircle2, Clock, MapPin, QrCode, Truck, User,
} from 'lucide-react'
import useReducedMotion from '../../hooks/useReducedMotion'
import { easing, heroImage, withReducedMotion } from '../../motion/motion'
import './landing-hero-scene.css'

function HeroFloatCard({ children, className, index = 0 }) {
  const reduced = useReducedMotion()
  const tilt = index % 2 === 0 ? -2 : 2

  return (
    <motion.div
      className={`hero-float motion-card-shadow${className ? ` ${className}` : ''}`}
      style={{ position: 'absolute' }}
      initial={{ opacity: 0, y: 28, scale: 0.9, rotate: tilt }}
      animate={reduced
        ? { opacity: 1, y: 0, scale: 1, rotate: tilt }
        : {
            opacity: 1,
            y: [0, -6, 0],
            scale: [1, 1.02, 1],
            rotate: [tilt, tilt + (tilt > 0 ? -1 : 1), tilt],
          }}
      transition={reduced
        ? { duration: 0.01 }
        : {
            opacity: { duration: 0.5, delay: 0.45 + index * 0.12, ease: easing.easeOut },
            y: { duration: 5.5 + index * 0.4, repeat: Infinity, ease: easing.easeInOut, delay: 0.45 + index * 0.12 },
            scale: { duration: 6 + index * 0.3, repeat: Infinity, ease: easing.easeInOut, delay: 0.45 + index * 0.12 },
            rotate: { duration: 7 + index * 0.2, repeat: Infinity, ease: easing.easeInOut, delay: 0.45 + index * 0.12 },
          }}
    >
      {children}
    </motion.div>
  )
}

function HeroHub({ reduced }) {
  return (
    <motion.div
      className="hero-hub"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: easing.easeOut, delay: 0.25 }}
    >
      <svg className="hero-hub__svg" viewBox="0 0 420 420" role="img" aria-labelledby="hero-hub-title">
        <title id="hero-hub-title">Live delivery route with GPS tracking</title>
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </radialGradient>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="hubShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="rgba(15,23,42,0.15)" />
          </filter>
        </defs>

        {/* Map contour */}
        <path
          className="hero-hub__contour"
          d="M60 280 C120 240 180 300 240 260 S360 220 380 180"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />
        <path
          className="hero-hub__contour hero-hub__contour--2"
          d="M40 320 C140 280 220 340 320 300 S400 260 400 240"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Glowing route lines (background) */}
        <path
          className="hero-hub__route-glow"
          d="M90 300 Q180 180 210 210 T330 120"
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.2"
        />

        {/* Animated route */}
        <path
          className={`hero-hub__route${reduced ? ' hero-hub__route--static' : ''}`}
          d="M90 300 Q180 180 210 210 T330 120"
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="420"
          strokeDashoffset="420"
        />

        {/* Radar rings */}
        {!reduced && (
          <>
            <circle className="hero-hub__radar hero-hub__radar--1" cx="210" cy="210" r="40" fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" />
            <circle className="hero-hub__radar hero-hub__radar--2" cx="210" cy="210" r="40" fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
            <circle className="hero-hub__radar hero-hub__radar--3" cx="210" cy="210" r="40" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
          </>
        )}

        <circle cx="210" cy="210" r="72" fill="url(#hubGlow)" />

        {/* Center glass panel */}
        <rect
          x="130"
          y="130"
          width="160"
          height="160"
          rx="20"
          fill="rgba(255,255,255,0.92)"
          filter="url(#hubShadow)"
          className="hero-hub__panel"
        />

        {/* Connected nodes */}
        <g className="hero-hub__nodes">
          <circle className="hero-hub__node hero-hub__node--pickup" cx="90" cy="300" r="8" fill="#2563eb" />
          <circle cx="90" cy="300" r="4" fill="#fff" />
          {!reduced && (
            <g className="hero-hub__orbit-wrap" transform="translate(210, 210)">
              <circle className="hero-hub__orbit" cx="0" cy="0" r="5" fill="#f97316" transform="translate(48, 0)" />
            </g>
          )}
          <circle className="hero-hub__node hero-hub__node--dest" cx="330" cy="120" r="8" fill="#10b981" />
          <circle cx="330" cy="120" r="4" fill="#fff" />
        </g>

        {/* GPS marker at driver position */}
        <g className="hero-hub__driver" transform="translate(210, 210)">
          {!reduced && (
            <>
              <circle className="hero-hub__gps-pulse hero-hub__gps-pulse--1" r="14" fill="rgba(37,99,235,0.25)" />
              <circle className="hero-hub__gps-pulse hero-hub__gps-pulse--2" r="14" fill="rgba(37,99,235,0.15)" />
            </>
          )}
          <circle r="10" fill="#2563eb" />
          <circle r="4" fill="#fff" />
          <path
            d="M0 -5 L0 2 M0 -5 L-3 -1 M0 -5 L3 -1"
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* Inner hub card content */}
      <div className="hero-hub__card">
        <div className="hero-hub__card-header">
          <span className="hero-hub__live-dot" aria-hidden />
          <span className="hero-hub__card-label">Live Dispatch</span>
        </div>
        <p className="hero-hub__card-title">Route Optimized</p>
        <div className="hero-hub__metrics">
          <div>
            <span className="hero-hub__metric-value">12.4</span>
            <span className="hero-hub__metric-unit">km</span>
          </div>
          <div className="hero-hub__metric-divider" aria-hidden />
          <div>
            <span className="hero-hub__metric-value hero-hub__metric-value--green">94%</span>
            <span className="hero-hub__metric-unit">on-time</span>
          </div>
        </div>
        <div className="hero-hub__progress">
          <div className="hero-hub__progress-bar" />
        </div>
      </div>
    </motion.div>
  )
}

function EtaCard({ index }) {
  return (
    <HeroFloatCard index={index} className="hero-float--eta">
      <div className="hero-float__icon hero-float__icon--orange">
        <Clock size={18} aria-hidden />
      </div>
      <p className="hero-float__title">Estimated Arrival</p>
      <p className="hero-float__value">
        14 <span className="hero-float__value-unit">min</span>
      </p>
      <div className="hero-float__progress" role="progressbar" aria-valuenow={72} aria-valuemin={0} aria-valuemax={100} aria-label="Delivery progress">
        <div className="hero-float__progress-fill hero-float__progress-fill--orange" style={{ width: '72%' }} />
      </div>
      <p className="hero-float__meta">Arriving at site · 2.4 km left</p>
    </HeroFloatCard>
  )
}

function StatusCard({ index }) {
  return (
    <HeroFloatCard index={index} className="hero-float--status">
      <div className="hero-float__row">
        <span className="hero-float__badge hero-float__badge--blue">
          <span className="hero-float__pulse" aria-hidden />
          En Route
        </span>
      </div>
      <p className="hero-float__title">Delivery Status</p>
      <p className="hero-float__value hero-float__value--sm">In Transit</p>
      <p className="hero-float__meta">Last updated · 28 sec ago</p>
    </HeroFloatCard>
  )
}

function VerificationCard({ index }) {
  return (
    <HeroFloatCard index={index} className="hero-float--verify hero-float--desktop-only">
      <div className="hero-float__icon hero-float__icon--green">
        <CheckCircle2 size={18} aria-hidden />
      </div>
      <p className="hero-float__title">Delivery Verified</p>
      <p className="hero-float__value hero-float__value--sm">POD Confirmed</p>
      <span className="hero-float__chip hero-float__chip--green">
        <QrCode size={12} aria-hidden />
        QR Verified
      </span>
    </HeroFloatCard>
  )
}

function TrackingCard({ index }) {
  return (
    <HeroFloatCard index={index} className="hero-float--tracking hero-float--tablet-up">
      <div className="hero-float__icon hero-float__icon--blue">
        <MapPin size={16} aria-hidden />
      </div>
      <p className="hero-float__title">Active Shipment</p>
      <p className="hero-float__tracking-id">XKFP2NQRLA</p>
      <div className="hero-float__details">
        <span><User size={12} aria-hidden /> Juan Dela Cruz</span>
        <span><Truck size={12} aria-hidden /> ABC-1234</span>
      </div>
    </HeroFloatCard>
  )
}

function HeroBackground({ reduced }) {
  return (
    <div className="hero-scene-bg" aria-hidden>
      <div className="hero-scene-bg__gradient" />
      <div className="hero-scene-bg__radial" />
      <div className="hero-scene-bg__grid" />
      {!reduced && (
        <>
          <div className="hero-scene-bg__route hero-scene-bg__route--1" />
          <div className="hero-scene-bg__route hero-scene-bg__route--2" />
          <div className="hero-scene-bg__particles">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={`hero-scene-bg__particle hero-scene-bg__particle--${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LandingHeroScene() {
  const reduced = useReducedMotion()

  return (
    <div className="hero-scene">
      <HeroBackground reduced={reduced} />
      <motion.div
        className="hero-scene__stage"
        variants={withReducedMotion(reduced, heroImage)}
        initial="hidden"
        animate="visible"
      >
        <HeroHub reduced={reduced} />
        <div className="hero-scene__cards">
          <EtaCard index={0} />
          <StatusCard index={1} />
          <VerificationCard index={2} />
          <TrackingCard index={3} />
        </div>
      </motion.div>
    </div>
  )
}

export default LandingHeroScene
