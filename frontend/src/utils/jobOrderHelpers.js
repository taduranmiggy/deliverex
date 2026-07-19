/**
 * Shared helpers for displaying Job Order customer names and addresses.
 * Uses structured fields when present; falls back to legacy combined fields
 * for older records created before the migration.
 */

import { formatAddressParts } from './jobOrderAddressValidation'

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
  if (standardized) return standardized

  const street = order?.[`${prefix}_street`]
  const barangay = order?.[`${prefix}_barangay`]
  const city = order?.[`${prefix}_city`]
  const province = order?.[`${prefix}_province`]
  if (street || city) {
    return formatAddressParts([street, barangay, city, province])
  }
  const legacy = order?.[`${prefix}_location`] || ''
  if (legacy) return legacy
  if (prefix === 'pickup') {
    return order?.quarry?.quarry_name || order?.quarry?.name || ''
  }
  return ''
}
