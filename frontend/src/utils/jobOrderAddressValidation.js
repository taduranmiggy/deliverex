const VAGUE_EXACT = /^(n\/?a|tbd|tba|none|unknown|site|location|address|here|somewhere|malapit|near|tabi|tapat)$/i
const VAGUE_CONTAINS = /\b(near|malapit|somewhere|around|tabi ng|tapat ng|harp ng)\b/i

const FIELD_LABELS = {
  street: 'Street / building / site name',
  barangay: 'Barangay',
  city: 'City / municipality',
  province: 'Province',
}

function isVaguePart(value, minLength = 3) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return true
  if (trimmed.length < minLength) return true
  if (VAGUE_EXACT.test(trimmed)) return true
  if (trimmed.length < 12 && VAGUE_CONTAINS.test(trimmed)) return true
  return false
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
  ].map((p) => String(p ?? '').trim()).filter(Boolean)

  const landmark = String(form[`${prefix}_landmark`] ?? '').trim()
  if (landmark) parts.push(`Near ${landmark}`)

  return parts.join(', ')
}
