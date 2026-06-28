import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useApiResource — shared data-fetching helper.
 *
 * Consolidates the loading / error / reload boilerplate that is repeated across
 * many pages. This is ADDITIVE and opt-in: it does not change any existing API
 * endpoint, payload, or page. New code can adopt it; existing code keeps working.
 *
 * @param {(signal?: AbortSignal) => Promise<any>} fetcher  async function returning data
 * @param {any[]} deps   dependency array that re-triggers the fetch (like useEffect)
 * @param {{ immediate?: boolean }} [options]
 * @returns {{ data, loading, error, reload, setData }}
 */
export function useApiResource(fetcher, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(immediate))
  const [error, setError] = useState('')

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(async (...args) => {
    setLoading(true)
    setError('')
    try {
      const result = await fetcherRef.current(...args)
      setData(result)
      return result
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!immediate) return undefined

    let active = true
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null

    setLoading(true)
    setError('')

    Promise.resolve(fetcherRef.current(controller?.signal))
      .then((result) => { if (active) setData(result) })
      .catch((err) => {
        if (active && err?.name !== 'AbortError') {
          setError(err?.message || 'Something went wrong. Please try again.')
        }
      })
      .finally(() => { if (active) setLoading(false) })

    return () => {
      active = false
      controller?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload, setData }
}

export default useApiResource
