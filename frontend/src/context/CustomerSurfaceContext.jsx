import { createContext, useContext, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { getCustomerPaths, getCustomerSurfaceFromPath } from '../utils/customerSurfacePaths'

const CustomerSurfaceContext = createContext(null)

export function CustomerSurfaceProvider({ surface, children }) {
  const paths = useMemo(() => getCustomerPaths(surface), [surface])
  const value = useMemo(() => ({ surface, paths }), [surface, paths])

  return (
    <CustomerSurfaceContext.Provider value={value}>
      {children}
    </CustomerSurfaceContext.Provider>
  )
}

export function useCustomerSurface() {
  const ctx = useContext(CustomerSurfaceContext)
  const location = useLocation()

  if (ctx) return ctx

  const surface = getCustomerSurfaceFromPath(location.pathname)
  return { surface, paths: getCustomerPaths(surface) }
}
