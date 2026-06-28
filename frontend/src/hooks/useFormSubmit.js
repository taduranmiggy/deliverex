import { useCallback, useState } from 'react'

/**
 * useFormSubmit — standardizes the form submission lifecycle.
 *
 * ADDITIVE / opt-in: nothing changes for existing forms. New (or refactored)
 * forms can adopt this to get consistent:
 *   - submitting state (disable submit button while processing)
 *   - top-level error message (validation summary)
 *   - per-field inline errors (from Laravel 422 `errors`, via err.fieldErrors)
 *   - success toast (when a showToast fn is provided)
 *
 * It does not change any API endpoint, payload, or workflow.
 *
 * @param {(...args:any[]) => Promise<any>} submitFn  the async API call
 * @param {{
 *   onSuccess?: (result:any) => void,
 *   onError?: (err:any) => void,
 *   successMessage?: string,
 *   showToast?: (msg:string, type?:string) => void,
 * }} [options]
 */
export function useFormSubmit(submitFn, options = {}) {
  const { onSuccess, onError, successMessage, showToast } = options

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const clearFieldError = useCallback((name) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setError('')
    setFieldErrors({})
  }, [])

  const submit = useCallback(async (...args) => {
    setSubmitting(true)
    setError('')
    setFieldErrors({})
    try {
      const result = await submitFn(...args)
      if (successMessage && showToast) showToast(successMessage, 'success')
      onSuccess?.(result)
      return result
    } catch (err) {
      // err.fieldErrors is the Laravel { field: [messages] } map (see api/client.js)
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        const flat = {}
        Object.entries(err.fieldErrors).forEach(([key, val]) => {
          flat[key] = Array.isArray(val) ? val[0] : String(val)
        })
        setFieldErrors(flat)
      }
      setError(err?.message || 'Something went wrong. Please try again.')
      onError?.(err)
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [submitFn, onSuccess, onError, successMessage, showToast])

  return { submit, submitting, error, fieldErrors, setError, clearFieldError, reset }
}

export default useFormSubmit
