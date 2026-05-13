export function roleHome(role) {
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
      return '/customer'
    default:
      return '/customer'
  }
}
