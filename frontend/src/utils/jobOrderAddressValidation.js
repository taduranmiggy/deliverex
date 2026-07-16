const VAGUE_EXACT = /^(n\/?a|tbd|tba|none|unknown|site|location|address|here|somewhere|malapit|near|tabi|tapat)$/i
const VAGUE_CONTAINS = /\b(near|malapit|somewhere|around|tabi ng|tapat ng|harp ng)\b/i

const FIELD_LABELS = {
  street: 'Street / building / site name',
  barangay: 'Barangay',
  city: 'City / municipality',
  province: 'Province',
}

export function isVagueAddress(value, minLength = 3) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return true
  if (trimmed.length < minLength) return true
  if (VAGUE_EXACT.test(trimmed)) return true
  if (trimmed.length < 12 && VAGUE_CONTAINS.test(trimmed)) return true
  return false
}

function isVaguePart(value, minLength = 3) {
  return isVagueAddress(value, minLength)
}

/**
 * Map a single full-address line into structured parts for the existing API.
 * Comma-separated values are split as street, barangay, city, province when possible.
 * Never copies the same value into multiple fields.
 */
export function parseFullAddressToStructured(fullAddress) {
  const trimmed = String(fullAddress ?? '').trim()
  if (!trimmed) {
    return { street: '', barangay: '', city: '', province: '' }
  }

  const segments = uniqueAddressParts(
    trimmed.split(',').map((p) => p.trim()).filter(Boolean),
  )

  if (segments.length >= 4) {
    return {
      street: segments.slice(0, -3).join(', '),
      barangay: segments[segments.length - 3],
      city: segments[segments.length - 2],
      province: segments[segments.length - 1],
    }
  }

  if (segments.length === 3) {
    return {
      street: segments[0],
      barangay: segments[1],
      city: segments[2],
      province: '',
    }
  }

  if (segments.length === 2) {
    return {
      street: segments[0],
      barangay: '',
      city: segments[1],
      province: '',
    }
  }

  return {
    street: segments[0] ?? trimmed,
    barangay: '',
    city: '',
    province: '',
  }
}

/** Remove duplicate segments before joining or parsing. */
export function uniqueAddressParts(parts) {
  const unique = []
  for (const part of parts) {
    const value = String(part ?? '').trim()
    if (!value) continue
    if (!unique.includes(value)) unique.push(value)
  }
  return unique
}

/** Format structured parts for display, skipping duplicate segments. */
export function formatAddressParts(parts) {
  return uniqueAddressParts(parts).join(', ')
}

/**
 * Step 3 route validation — pickup + destination lines only.
 * @param {Record<string, string>} form
 * @param {{ pickupFromQuarry?: boolean }} [options]
 */
export function validateSimpleRouteStep(form, options = {}) {
  const errors = {}
  const { pickupFromQuarry = false } = options

  const pickupLine = String(form.pickup_location ?? '').trim()
  if (!pickupLine) {
    errors.pickup_location = pickupFromQuarry
      ? 'Select a quarry or supplier for pickup.'
      : 'Pickup location is required.'
  } else if (!pickupFromQuarry && isVagueAddress(pickupLine, 5)) {
    errors.pickup_location = 'Enter a specific pickup address, not a vague label.'
  }

  const destinationLine = String(form.dropoff_location ?? '').trim()
  if (!destinationLine) {
    errors.dropoff_location = 'Destination is required.'
  } else if (isVagueAddress(destinationLine, 5)) {
    errors.dropoff_location = 'Enter a specific destination address, not a vague label.'
  }

  return errors
}

/**
 * @param {'pickup'|'dropoff'} prefix
 * @param {Record<string, string>} form
 * @param {{ requirePickup?: boolean }} [options]
 * @returns {Record<string, string>}
 */
export function validateJobOrderAddresses(form, options = {}) {
  const errors = {}
  const { requirePickup = false } = options

  const check = (prefix, required) => {
    const street = form[`${prefix}_street`]
    const barangay = form[`${prefix}_barangay`]
    const city = form[`${prefix}_city`]
    const province = form[`${prefix}_province`]

    if (!required) return

    if (isVaguePart(street, 5)) {
      errors[`${prefix}_street`] = `${FIELD_LABELS.street} is required. Use a specific address, not a vague label.`
    }
    if (isVaguePart(barangay)) {
      errors[`${prefix}_barangay`] = `${FIELD_LABELS.barangay} is required.`
    }
    if (isVaguePart(city)) {
      errors[`${prefix}_city`] = `${FIELD_LABELS.city} is required.`
    }
    if (isVaguePart(province)) {
      errors[`${prefix}_province`] = `${FIELD_LABELS.province} is required.`
    }
  }

  check('dropoff', true)
  check('pickup', requirePickup)

  return errors
}

export function composeStructuredAddress(prefix, form) {
  const parts = [
    form[`${prefix}_street`],
    form[`${prefix}_barangay`],
    form[`${prefix}_city`],
    form[`${prefix}_province`],
  ]

  const landmark = String(form[`${prefix}_landmark`] ?? '').trim()
  const formatted = formatAddressParts(parts)
  if (!landmark) return formatted
  return formatted ? `${formatted}, Near ${landmark}` : `Near ${landmark}`
}
