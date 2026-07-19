import { useEffect } from 'react'
import { installAutoUppercaseInputListeners } from '../utils/autoUppercaseInput'

/**
 * Installs document-level auto-uppercase listeners for all applicable inputs.
 * Excludes emails, passwords, phones, URLs, tracking IDs, and numeric fields.
 */
export default function AutoUppercaseInputProvider({ children }) {
  useEffect(() => installAutoUppercaseInputListeners(document), [])
  return children
}
