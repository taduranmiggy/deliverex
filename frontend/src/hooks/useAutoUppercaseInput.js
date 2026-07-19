import { useCallback } from 'react'
import { shouldAutoUppercaseInput, toUppercaseInputValue } from '../utils/autoUppercaseInput'

/**
 * Hook for controlled text fields that should store/display ALL CAPS.
 * @param {string} value
 * @param {Function} onChange
 * @param {{ preserveCase?: boolean, inputType?: string, name?: string }} [options]
 */
export default function useAutoUppercaseInput(value, onChange, options = {}) {
  const { preserveCase = false } = options

  const handleChange = useCallback((event) => {
    if (preserveCase || !onChange) {
      onChange?.(event)
      return
    }

    const el = event?.target
    if (el && shouldAutoUppercaseInput(el)) {
      const upper = toUppercaseInputValue(el.value)
      if (upper !== el.value) {
        el.value = upper
      }
    }

    onChange(event)
  }, [onChange, preserveCase])

  const displayValue = preserveCase ? value : toUppercaseInputValue(value)

  return { value: displayValue, onChange: handleChange }
}
