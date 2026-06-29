export const CUSTOMER_SURFACES = {
  pwa: {
    home: '/customer',
    dashboard: '/customer',
    track: '/customer/track',
    history: '/customer/history',
    deliveries: '/customer/deliveries',
    support: '/customer/support',
    feedback: '/customer/feedback',
    linkDelivery: '/customer/link-delivery',
    team: '/customer/team',
    account: '/customer/account',
    profile: '/customer/account',
    about: '/customer/about',
    services: '/customer/services',
    login: '/customer/login',
    signIn: '/customer/login',
  },
  web: {
    home: '/customer-web/dashboard',
    dashboard: '/customer-web/dashboard',
    track: '/customer-web/track',
    history: '/customer-web/history',
    deliveries: '/customer-web/deliveries',
    support: '/customer-web/support',
    feedback: '/customer-web/feedback',
    linkDelivery: '/customer-web/link-delivery',
    team: '/customer-web/team',
    account: '/customer-web/profile',
    profile: '/customer-web/profile',
    about: '/customer/about',
    services: '/customer/services',
    login: '/login',
    signIn: '/login',
  },
}

export function getCustomerSurfaceFromPath(pathname = '') {
  return pathname.startsWith('/customer-web') ? 'web' : 'pwa'
}

export function getCustomerPaths(surface) {
  return CUSTOMER_SURFACES[surface] ?? CUSTOMER_SURFACES.pwa
}

/** Nav targets for customer shell — logged-in browser users use the website portal. */
export function getCustomerNavPaths({ isCustomer, isPwa }) {
  if (isCustomer && !isPwa) {
    return getCustomerPaths('web')
  }
  if (isPwa) {
    return getCustomerPaths('pwa')
  }
  return {
    home: '/',
    dashboard: '/',
    track: '/customer/track',
    about: '/customer/about',
    services: '/customer/services',
    support: '/customer/support',
    feedback: '/customer/feedback',
    deliveries: '/customer/deliveries',
    account: '/customer/account',
    profile: '/customer/account',
    signIn: '/login',
  }
}
