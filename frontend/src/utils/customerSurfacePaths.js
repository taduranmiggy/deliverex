export const CUSTOMER_SURFACES = {
  pwa: {
    home: '/customer',
    dashboard: '/customer',
    track: '/customer/track',
    history: '/customer/history',
    deliveries: '/customer/deliveries',
    support: '/customer/support',
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
