/**
 * Shared helpers for displaying Job Order customer names and addresses.
 * Uses structured fields when present; falls back to legacy combined fields
 * for older records created before the migration.
 */

import { formatAddressParts } from './jobOrderAddressValidation'

/** Strip noisy PSGC suffixes and normalize ALL CAPS strings for UI display. */
export function formatAddressForDisplay(address) {
  const raw = String(address ?? '').trim()
  if (!raw) return ''

  let text = raw
    .replace(/,\s*PHILIPPINES\s*$/i, '')
    .replace(/,\s*REGION [^,]+(?:\s*\([^)]+\))?/gi, '')
    .replace(/,\s*NATIONAL CAPITAL REGION(?:\s*\([^)]+\))?/gi, ', Metro Manila')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim()

  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters.length >= 8 && letters === letters.toUpperCase()) {
    text = text
      .toLowerCase()
      .replace(/(?:^|[\s,/(-])(\p{L})/gu, (match, letter) => match.slice(0, -1) + letter.toUpperCase())
  }

  return text
}

/**
 * Short label for tables and lists: street/building + city (no barangay/region noise).
 * @param {'pickup'|'dropoff'} prefix
 */
export function buildCompactRouteStop(prefix, order) {
  const street = String(order?.[`${prefix}_street`] ?? '').trim()
  const city = String(order?.[`${prefix}_city`] ?? '').trim()
  const province = String(order?.[`${prefix}_province`] ?? '').trim()

  if (street && city) {
    return formatAddressForDisplay(formatAddressParts([street, city]))
  }

  if (city && province) {
    return formatAddressForDisplay(formatAddressParts([city, province]))
  }

  const full = buildDisplayAddress(prefix, order)
  const parts = full.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return formatAddressForDisplay(`${parts[0]}, ${parts[1]}`)
  }

  return formatAddressForDisplay(parts[0] || full)
}

/** Compact pickup → dropoff label for dense tables. */
export function buildRouteSummary(order) {
  const pickup = buildCompactRouteStop('pickup', order)
  const dropoff = buildCompactRouteStop('dropoff', order)
  if (!pickup && !dropoff) return '—'
  if (!pickup) return dropoff
  if (!dropoff) return pickup
  return `${pickup} → ${dropoff}`
}

/** Build a display-ready full name from structured parts or legacy field. */
export function buildDisplayName(order) {
  if (order?.company?.company_name) return order.company.company_name
  if (order?.client?.client_name) return order.client.client_name
  if (order?.client?.company_name) return order.client.company_name
  if (order?.custom_client_name) return order.custom_client_name
  if (order?.customer_first_name || order?.customer_last_name) {
    return [
      order.customer_first_name,
      order.customer_middle_name,
      order.customer_last_name,
      order.customer_suffix,
    ].filter(Boolean).join(' ')
  }
  return order?.customer_name || ''
}

/**
 * Build a display-ready address from structured parts or legacy combined field.
 * @param {'pickup'|'dropoff'} prefix
 * @param {object} order  job order record
 */
export function buildDisplayAddress(prefix, order) {
  const standardized = order?.[`${prefix}_formatted_address`]
  if (standardized) return formatAddressForDisplay(standardized)

  const street = order?.[`${prefix}_street`]
  const barangay = order?.[`${prefix}_barangay`]
  const city = order?.[`${prefix}_city`]
  const province = order?.[`${prefix}_province`]
  if (street || city) {
    return formatAddressForDisplay(formatAddressParts([street, barangay, city, province]))
  }
  const legacy = order?.[`${prefix}_location`] || ''
  if (legacy) return formatAddressForDisplay(legacy)
  if (prefix === 'pickup') {
    const quarry = order?.quarry?.quarry_name || order?.quarry?.name || ''
    return formatAddressForDisplay(quarry)
  }
  return ''
}
