import { useCallback, useRef, useState } from 'react'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'

/**
 * Declarative helper for replacing window.confirm() without duplicating modal state.
 *
 * @example
 * const { requestConfirmation, confirmationModal } = useConfirmation()
 * requestConfirmation({ title, message, onConfirm: async () => { ... } })
 * return <>{confirmationModal}</>
 */
export function useConfirmation() {
  const [state, setState] = useState(null)
  const onConfirmRef = useRef(null)

  const requestConfirmation = useCallback((options) => {
    onConfirmRef.current = options.onConfirm
    const { onConfirm, ...modalProps } = options
    setState({ modalProps, loading: false })
  }, [])

  const handleCancel = useCallback(() => {
    if (state?.loading) return
    setState(null)
    onConfirmRef.current = null
  }, [state?.loading])

  const handleConfirm = useCallback(async () => {
    const action = onConfirmRef.current
    if (!action || state?.loading) return

    setState((current) => ({ ...current, loading: true }))
    try {
      await action()
      setState(null)
      onConfirmRef.current = null
    } catch {
      setState((current) => (current ? { ...current, loading: false } : null))
    }
  }, [state?.loading])

  const confirmationModal = state ? (
    <ConfirmationModal
      open
      {...state.modalProps}
      loading={state.loading}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { requestConfirmation, confirmationModal }
}

export default useConfirmation
