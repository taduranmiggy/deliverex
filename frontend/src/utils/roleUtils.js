import { isStandalonePwa } from './pwaUtils'

export function roleHome(role, options = {}) {
  const surface = options.surface ?? (isStandalonePwa() ? 'pwa' : 'web')

  switch (role) {
    case 'admin':
      return '/admin'
    case 'dispatcher':
      return '/dispatcher'
    case 'driver':
      return '/driver'
    case 'manager':
      return '/manager'
    case 'customer':
      return surface === 'pwa' ? '/customer' : '/customer-web/dashboard'
    default:
      return surface === 'pwa' ? '/customer' : '/'
  }
}
