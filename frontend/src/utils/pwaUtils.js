/** True when the app is running as an installed PWA (home screen / standalone). */
export function isStandalonePwa() {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true
  )
}

/** Paths that belong to the customer PWA — staff and driver use the mobile browser instead. */
export function isCustomerPwaPath(pathname) {
  return pathname === '/customer' || pathname.startsWith('/customer/')
}
