/**
 * Auto-uppercase input utilities — presentation + storage layer.
 * Converts user-typed text to ALL CAPS while preserving cursor position.
 * Skips emails, passwords, phones, URLs, tracking IDs, and other sensitive fields.
 */

const EXCLUDED_INPUT_TYPES = new Set([
  'email',
  'password',
  'url',
  'tel',
  'number',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'file',
  'hidden',
  'range',
  'color',
])

const EXCLUDED_AUTOCOMPLETE = /(?:^|\b)(email|username|current-password|new-password|one-time-code|tel)(?:$|\b)/i

const EXCLUDED_FIELD_PATTERN = /(?:^|[._[\]-])(?:email|password|username|user_email|login|url|uri|token|api[_-]?key|secret|tracking[_-]?code|tracking[_-]?id|track(?:ing)?[_-]?code|uuid|guid|qr[_-]?code|phone|mobile|tel|otp|otp[_-]?code|plate(?:[_-]?no)?|file(?:[_-]?name)?|filename|lat(?:itude)?|lng|longitude|coordinates?)(?:$|[._[\]-])/i

function fieldTokens(element) {
  const parts = [
    element.name,
    element.id,
    element.getAttribute('aria-label'),
    element.placeholder,
    element.dataset?.field,
  ].filter(Boolean)

  return parts.join(' ').toLowerCase()
}

function matchesExcludedField(element) {
  const tokens = fieldTokens(element)
  if (EXCLUDED_FIELD_PATTERN.test(tokens)) return true
  if (EXCLUDED_AUTOCOMPLETE.test(element.autocomplete || '')) return true

  const id = (element.id || '').toLowerCase()
  if (id === 'tid' || id === 'trackcode' || id === 'tracking_code' || id === 'track_code') return true

  const placeholder = (element.placeholder || '').toLowerCase()
  if (placeholder.includes('tracking id') || placeholder.includes('tracking code')) return true

  return false
}

/**
 * Whether this input/textarea should auto-uppercase on entry.
 * @param {HTMLInputElement|HTMLTextAreaElement|null|undefined} element
 */
export function shouldAutoUppercaseInput(element) {
  if (!element || element.readOnly || element.disabled) return false
  if (element.dataset?.preserveCase === 'true' || element.dataset?.noUppercase === 'true') return false
  if (element.classList?.contains('dx-preserve-case')) return false

  if (element instanceof HTMLTextAreaElement) {
    return !matchesExcludedField(element)
  }

  if (!(element instanceof HTMLInputElement)) return false

  const type = (element.type || 'text').toLowerCase()
  if (EXCLUDED_INPUT_TYPES.has(type)) return false

  const inputMode = (element.inputMode || '').toLowerCase()
  if (inputMode === 'numeric' || inputMode === 'decimal') return false

  if (matchesExcludedField(element)) return false

  return type === 'text' || type === 'search' || type === ''
}

/**
 * @param {string|null|undefined} value
 * @param {{ force?: boolean }} [options]
 */
export function toUppercaseInputValue(value) {
  if (value == null) return value
  return String(value).toUpperCase()
}

/**
 * Apply uppercase to a native input/textarea and notify React/other listeners.
 * @param {HTMLInputElement|HTMLTextAreaElement} element
 * @returns {boolean} true when value changed
 */
export function applyUppercaseToElement(element) {
  if (!shouldAutoUppercaseInput(element)) return false

  const current = element.value
  const upper = toUppercaseInputValue(current)
  if (current === upper) return false

  const start = element.selectionStart
  const end = element.selectionEnd

  const proto = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  descriptor?.set?.call(element, upper)

  if (start != null && end != null) {
    try {
      element.setSelectionRange(start, end)
    } catch {
      // Some input types do not support selection ranges.
    }
  }

  element.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

/**
 * React-friendly change handler wrapper for controlled inputs.
 * @param {Function} onChange
 * @param {{ preserveCase?: boolean }} [options]
 */
export function withUppercaseChange(onChange, options = {}) {
  if (typeof onChange !== 'function') return onChange
  if (options.preserveCase) return onChange

  return (event) => {
    const el = event?.target
    if (el && shouldAutoUppercaseInput(el)) {
      const upper = toUppercaseInputValue(el.value)
      if (upper !== el.value) {
        el.value = upper
      }
    }
    onChange(event)
  }
}

/**
 * Install global capture listeners for auto-uppercase across the app.
 * @returns {() => void} cleanup
 */
export function installAutoUppercaseInputListeners(root = document) {
  const onInput = (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
    applyUppercaseToElement(target)
  }

  const onPaste = (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
    if (!shouldAutoUppercaseInput(target)) return
    requestAnimationFrame(() => applyUppercaseToElement(target))
  }

  root.addEventListener('input', onInput, true)
  root.addEventListener('paste', onPaste, true)

  return () => {
    root.removeEventListener('input', onInput, true)
    root.removeEventListener('paste', onPaste, true)
  }
}
