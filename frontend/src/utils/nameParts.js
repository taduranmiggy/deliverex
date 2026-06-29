/**
 * Split a stored full name into form fields (backward compatible with legacy single-field names).
 */
export function splitFullName(fullName) {
  const trimmed = String(fullName ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return { first_name: '', middle_initial: '', last_name: '' }
  }

  const parts = trimmed.split(' ')
  if (parts.length === 1) {
    return { first_name: parts[0], middle_initial: '', last_name: parts[0] }
  }

  if (parts.length === 2) {
    return { first_name: parts[0], middle_initial: '', last_name: parts[1] }
  }

  const first_name = parts[0]
  const last_name = parts[parts.length - 1]
  const middle = parts.slice(1, -1).join(' ')
  const middle_initial = sanitizeMiddleInitial(middle.replace(/\./g, '').slice(0, 2))

  return { first_name, middle_initial, last_name }
}

/** Compose API `name` from structured parts. */
export function composeFullName({ first_name, middle_initial, last_name }) {
  const first = String(first_name ?? '').trim()
  const last = String(last_name ?? '').trim()
  const middle = sanitizeMiddleInitial(middle_initial)

  return [first, middle, last].filter(Boolean).join(' ')
}

/** Optional middle initial: letters only, max 2, uppercase. */
export function sanitizeMiddleInitial(value) {
  const letters = String(value ?? '').replace(/[^a-zA-Z]/g, '').toUpperCase()
  return letters.slice(0, 2)
}

export function validateNameParts({ first_name, middle_initial, last_name }) {
  const errors = {}
  const first = String(first_name ?? '').trim()
  const last = String(last_name ?? '').trim()

  if (!first) errors.first_name = 'First name is required.'
  else if (first.length > 60) errors.first_name = 'First name is too long.'

  if (!last) errors.last_name = 'Last name is required.'
  else if (last.length > 60) errors.last_name = 'Last name is too long.'

  const middle = sanitizeMiddleInitial(middle_initial)
  if (middle_initial && !middle) {
    errors.middle_initial = 'Middle initial must be letters only.'
  }

  return errors
}
