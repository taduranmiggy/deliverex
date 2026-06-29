const PH_MOBILE_DIGITS = /^9\d{9}$/

/** Strip to national mobile digits (9XXXXXXXXX) from stored or pasted values. */
export function extractPhMobileDigits(value) {
  let digits = String(value ?? '').replace(/\D/g, '')

  if (digits.startsWith('63') && digits.length > 2) {
    digits = digits.slice(2)
  }
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1)
  }

  return digits.slice(0, 10)
}

/** National digits for the +63 input (10 chars max, leading 9). */
export function sanitizePhMobileInput(value) {
  const digits = extractPhMobileDigits(value)
  if (!digits) return ''
  if (!digits.startsWith('9')) {
    return digits.replace(/^[^9]+/, '').slice(0, 10)
  }
  return digits.slice(0, 10)
}

export function isValidPhMobileDigits(digits) {
  return PH_MOBILE_DIGITS.test(digits)
}

/** Compact storage: +639171234567 (complete numbers only). */
export function formatPhoneForStorage(nationalDigits) {
  const digits = sanitizePhMobileInput(nationalDigits)
  if (!isValidPhMobileDigits(digits)) return ''
  return `+63${digits}`
}

/** Form state while typing — keeps partial +63… values until the number is complete. */
export function formatPhoneDraftForStorage(nationalDigits) {
  const digits = sanitizePhMobileInput(nationalDigits)
  return digits ? `+63${digits}` : ''
}

/** Display digits for the input beside fixed +63. */
export function parsePhoneForInput(stored) {
  return sanitizePhMobileInput(stored)
}

export function formatPhoneDisplay(stored) {
  const digits = parsePhoneForInput(stored)
  if (!digits) return ''
  return `+63 ${digits}`
}

/** Last four digits of the national mobile number. */
export function phoneLastFour(storedOrDigits) {
  const digits = sanitizePhMobileInput(storedOrDigits)
  if (digits.length < 4) return ''
  return digits.slice(-4)
}

export function validatePhPhone(storedOrDigits, { required = true } = {}) {
  const digits = sanitizePhMobileInput(storedOrDigits)
  if (!digits) {
    return required ? 'Phone number is required.' : ''
  }
  if (!isValidPhMobileDigits(digits)) {
    return 'Enter a valid Philippine mobile number (e.g. 917 123 4567).'
  }
  return ''
}
