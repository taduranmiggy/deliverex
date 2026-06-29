import { phoneLastFour } from './phonePh.js'

const MIN_PASSWORD_LENGTH = 8

/**
 * Initial password: LastName_Last4DigitsOfPhone
 * Example: Cruz + 9171234567 → Cruz_4567
 */
export function generateInitialPassword(lastName, phoneNationalDigits) {
  const last = String(lastName ?? '').trim()
  const last4 = phoneLastFour(phoneNationalDigits)

  if (!last || !last4) return ''

  // Preserve capitalization from last name; underscore + 4 digits.
  return `${last}_${last4}`
}

export function validateGeneratedPassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Generated password must be at least ${MIN_PASSWORD_LENGTH} characters. Check last name and phone number.`
  }
  return ''
}
