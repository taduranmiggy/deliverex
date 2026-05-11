/** Demo-only currency formatter when API has no invoice amount yet */
export function formatDemoPhp(seed) {
  const n = Number(seed) || 0
  const amount = 5000 + (n * 137) % 45000
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

export function formatJobPublicId(orderId, year = 2026) {
  const num = Number(orderId) || 0
  return `J-${year}-${String(num).padStart(3, '0')}`
}
