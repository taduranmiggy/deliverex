export const FLEET_SYNC_INTERVAL_MS = 60_000
export const DRIVER_OFFLINE_THRESHOLD_SEC = 120

/** Philippines service-area bounds (matches backend gps.philippines_bounds). */
const PH_BOUNDS = { minLat: 4.5, maxLat: 21.5, minLng: 116, maxLng: 127.5 }

export function isValidMapCoordinate(lat, lng) {
  const nLat = Number(lat)
  const nLng = Number(lng)
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false
  if (Math.abs(nLat) < 0.0001 && Math.abs(nLng) < 0.0001) return false
  if (nLat < PH_BOUNDS.minLat || nLat > PH_BOUNDS.maxLat) return false
  if (nLng < PH_BOUNDS.minLng || nLng > PH_BOUNDS.maxLng) return false
  return true
}

export function parseValidatedCoordinate(value, otherValue) {
  const lat = Number(value)
  const lng = Number(otherValue)
  return isValidMapCoordinate(lat, lng) ? lat : null
}

export function secondsSince(isoOrDate) {
  if (!isoOrDate) return null
  const ts = isoOrDate instanceof Date ? isoOrDate.getTime() : new Date(isoOrDate).getTime()
  if (!Number.isFinite(ts)) return null
  return Math.max(0, Math.floor((Date.now() - ts) / 1000))
}

export function formatRelativeSeconds(totalSeconds) {
  if (totalSeconds == null) return '—'
  if (totalSeconds < 60) return `${totalSeconds} second${totalSeconds === 1 ? '' : 's'} ago`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

export function formatDriverGpsAge(iso) {
  return formatRelativeSeconds(secondsSince(iso))
}

export function isDriverOffline(location) {
  if (!location?.at) return true
  const age = location.offline?.age_seconds ?? secondsSince(location.at)
  if (age == null) return false
  return age >= DRIVER_OFFLINE_THRESHOLD_SEC || Boolean(location.is_stale)
}

export function coordPairChanged(a, b) {
  if (a === b) return false
  if (!a || !b) return Boolean(a) !== Boolean(b)
  return a.lat !== b.lat || a.lng !== b.lng
}

export function deliveriesChanged(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return true
  if (prev.length !== next.length) return true

  for (let i = 0; i < next.length; i += 1) {
    const a = prev[i]
    const b = next[i]
    if (!a || !b || a.id !== b.id) return true
    if (a.status !== b.status) return true

    if (coordPairChanged(a.pickup, b.pickup)) return true
    if (coordPairChanged(a.destination, b.destination)) return true

    const locA = a.location
    const locB = b.location
    if (Boolean(locA) !== Boolean(locB)) return true
    if (locA && locB) {
      if (locA.lat !== locB.lat || locA.lng !== locB.lng || locA.at !== locB.at) return true
      if (locA.offline?.state !== locB.offline?.state) return true
    }

    const routeA = a.route?.polyline?.length ?? 0
    const routeB = b.route?.polyline?.length ?? 0
    if (routeA !== routeB) return true

    const deliveryRouteA = a.delivery_route?.polyline?.length ?? 0
    const deliveryRouteB = b.delivery_route?.polyline?.length ?? 0
    if (deliveryRouteA !== deliveryRouteB) return true

    const warningsA = (a.location_status?.warnings ?? []).join('|')
    const warningsB = (b.location_status?.warnings ?? []).join('|')
    if (warningsA !== warningsB) return true

    const delayA = a.latest_delay_report
    const delayB = b.latest_delay_report
    if ((delayA?.id ?? null) !== (delayB?.id ?? null)) return true
    if ((delayA?.acknowledged_at ?? null) !== (delayB?.acknowledged_at ?? null)) return true
  }

  return false
}
