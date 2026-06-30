import { useEffect, useMemo, useState } from 'react'

/**
 * Client-side pagination for static or filtered lists.
 */
export function useClientPagination(items, { perPage = 8, resetKey = '' } = {}) {
  const [page, setPage] = useState(1)

  const total = items?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(total / perPage) || 1)
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [resetKey, perPage])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const slice = useMemo(() => {
    const start = (safePage - 1) * perPage
    return items.slice(start, start + perPage)
  }, [items, safePage, perPage])

  return {
    page: safePage,
    perPage,
    total,
    totalPages,
    slice,
    setPage,
  }
}
