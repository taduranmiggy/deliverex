/** @typedef {import('framer-motion').Transition} Transition */
/** @typedef {import('framer-motion').Variants} Variants */

export const duration = {
  fast: 0.2,
  base: 0.3,
  medium: 0.5,
  slow: 0.7,
  section: 0.6,
}

export const easing = {
  easeOut: [0.22, 1, 0.36, 1],
  easeInOut: [0.45, 0, 0.55, 1],
}

export const spring = {
  tap: { type: 'spring', stiffness: 400, damping: 30 },
}

export const stagger = {
  hero: 0.1,
  nav: 0.08,
  section: 0.08,
}

/** @type {Transition} */
export const transitionEaseOut = {
  duration: duration.medium,
  ease: easing.easeOut,
}

/** @type {Transition} */
export const transitionSection = {
  duration: duration.section,
  ease: easing.easeOut,
}

/** @type {Variants} */
export const pageEnter = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.slow, ease: easing.easeOut },
  },
}

/** @type {Variants} */
export const pageExit = {
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: duration.base, ease: easing.easeInOut },
  },
}

/** @type {Variants} */
export const routeEnter = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.medium, ease: easing.easeOut },
  },
}

/** @type {Variants} */
export const routeExit = {
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: duration.base, ease: easing.easeInOut },
  },
}

/** @type {Variants} */
export const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionSection,
  },
}

/** @type {Variants} */
export const heroChild = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: duration.medium,
      ease: easing.easeOut,
      delay: i * stagger.hero,
    },
  }),
}

/** @type {Variants} */
export const heroImage = {
  hidden: { opacity: 0, y: 16, scale: 1.05 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.slow, ease: easing.easeOut, delay: 0.35 },
  },
}

/** @type {Variants} */
export const floatY = {
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: easing.easeInOut,
    },
  },
}

/** @type {Variants} */
export const floatCard = {
  hidden: { opacity: 0, y: 20, scale: 0.96, rotate: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: duration.medium,
      ease: easing.easeOut,
      delay: 0.5 + i * stagger.hero,
    },
  }),
  float: (i = 0) => ({
    y: [0, -6, 0],
    rotate: [0, i % 2 === 0 ? 2 : -2, 0],
    transition: {
      duration: 5 + i * 0.5,
      repeat: Infinity,
      ease: easing.easeInOut,
      delay: i * 0.3,
    },
  }),
}

/** @type {Variants} */
export const cardEnter = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: duration.section,
      ease: easing.easeOut,
      delay: i * stagger.section,
    },
  }),
}

/** @type {Variants} */
export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -6,
    scale: 1.02,
    transition: { duration: duration.base, ease: easing.easeOut },
  },
}

/** @type {Variants} */
export const buttonHover = {
  rest: { scale: 1 },
  hover: {
    scale: 1.04,
    transition: { duration: duration.fast, ease: easing.easeOut },
  },
  tap: { scale: 0.98, transition: spring.tap },
}

/** @type {Variants} */
export const iconHover = {
  rest: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.1,
    rotate: 4,
    transition: { duration: 0.25, ease: easing.easeOut },
  },
}

/** @type {Variants} */
export const modalBackdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}

/** @type {Variants} */
export const modalContent = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.medium, ease: easing.easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 8,
    transition: { duration: duration.fast, ease: easing.easeInOut },
  },
}

/** @type {Variants} */
export const tooltip = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.fast, ease: easing.easeOut },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: duration.fast },
  },
}

/** @type {Variants} */
export const dropdown = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.easeOut },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: duration.fast },
  },
}

/** @type {Variants} */
export const imageReveal = {
  hidden: { opacity: 0, scale: 1.04, clipPath: 'inset(8% 8% 8% 8%)' },
  visible: {
    opacity: 1,
    scale: 1,
    clipPath: 'inset(0% 0% 0% 0%)',
    transition: { duration: duration.slow, ease: easing.easeOut },
  },
}

/** @type {Variants} */
export const navbarEnter = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.medium, ease: easing.easeOut },
  },
}

/** @type {Variants} */
export const navItem = {
  hidden: { opacity: 0, y: -6 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.base,
      ease: easing.easeOut,
      delay: 0.12 + i * stagger.nav,
    },
  }),
}

/** @type {Variants} */
export const bgGrid = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.slow, ease: easing.easeOut, delay: 0.2 },
  },
}

/** @type {Variants} */
export const slideCrossfade = {
  enter: (dir) => ({
    opacity: 0,
    x: dir > 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.medium, ease: easing.easeOut },
  },
  exit: (dir) => ({
    opacity: 0,
    x: dir > 0 ? -24 : 24,
    transition: { duration: duration.base, ease: easing.easeInOut },
  }),
}

export const viewportOnce = {
  once: true,
  margin: '-80px',
  amount: 0.15,
}

/** @param {boolean} reduced */
export function withReducedMotion(reduced, variants) {
  if (!reduced) return variants
  const instant = { duration: 0.01 }
  if (typeof variants === 'object' && variants !== null) {
    return Object.fromEntries(
      Object.entries(variants).map(([key, val]) => {
        if (typeof val === 'function') {
          return [key, () => ({ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, transition: instant })]
        }
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return [key, { ...val, transition: instant }]
        }
        return [key, val]
      }),
    )
  }
  return variants
}

/** @param {boolean} reduced */
export function instantTransition(reduced, fallback = transitionEaseOut) {
  return reduced ? { duration: 0.01 } : fallback
}
