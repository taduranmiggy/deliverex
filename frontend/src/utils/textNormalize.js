const MOJIBAKE_PATTERN = /Ã|Â|â€™|â€œ|â€|ï¿½/

/**
 * Repair UTF-8 text that was incorrectly interpreted as Latin-1 (e.g. "NiÃ±o" → "Niño").
 * @param {string|null|undefined} text
 */
export function fixUtf8Mojibake(text) {
  if (text == null || text === '') return text ?? ''
  const value = String(text)
  if (!MOJIBAKE_PATTERN.test(value)) return value

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (fixed && !fixed.includes('\uFFFD') && fixed !== value) return fixed
  } catch {
    // Fall through to original value.
  }

  return value
}

/**
 * Normalize text for accent-insensitive PSGC search matching.
 * @param {string|null|undefined} text
 */
export function normalizeSearchKey(text) {
  return fixUtf8Mojibake(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stripAdministrativeSuffix(key) {
  return key.replace(/\s+(city|municipality)$/i, '').trim()
}

/**
 * Find the best PSGC option for a typed query.
 * @param {string} query
 * @param {Array<{ code: string, name: string }>} options
 * @returns {{ code: string, name: string }|null}
 */
export function findBestPsgcMatch(query, options = []) {
  const raw = String(query || '').trim()
  if (!raw || !Array.isArray(options) || options.length === 0) return null

  const normalizedQuery = normalizeSearchKey(raw)
  if (!normalizedQuery) return null

  const exact = options.find((option) => normalizeSearchKey(option.name) === normalizedQuery)
  if (exact) return exact

  const queryCore = stripAdministrativeSuffix(normalizedQuery)
  const prefixMatches = options.filter((option) => {
    const optionKey = stripAdministrativeSuffix(normalizeSearchKey(option.name))
    return optionKey.startsWith(queryCore) || queryCore.startsWith(optionKey)
  })
  if (prefixMatches.length === 1) return prefixMatches[0]

  const containsMatches = options.filter((option) =>
    normalizeSearchKey(option.name).includes(queryCore),
  )
  if (containsMatches.length === 1) return containsMatches[0]

  return null
}

/**
 * Display-safe uppercase for PSGC labels (preserves Ñ and other Unicode letters).
 * @param {string|null|undefined} text
 */
export function toDisplayUpper(text) {
  return fixUtf8Mojibake(text).toUpperCase()
}

/**
 * Sanitize an option name from the PSGC API for storage/display.
 * @param {string|null|undefined} name
 */
export function sanitizePsgcName(name) {
  return toDisplayUpper(name)
}
