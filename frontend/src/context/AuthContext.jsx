import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getProfile, logout as logoutApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const rawUser = localStorage.getItem('deliverex_user')
        const savedToken = localStorage.getItem('deliverex_token')
        if (rawUser) {
          setUser(JSON.parse(rawUser))
        }
        if (savedToken) {
          setToken(savedToken)
          try {
            const me = await getProfile()
            if (!cancelled && me) {
              setUser(me)
              localStorage.setItem('deliverex_user', JSON.stringify(me))
            }
          } catch {
            if (!cancelled) {
              localStorage.removeItem('deliverex_user')
              localStorage.removeItem('deliverex_token')
              setUser(null)
              setToken(null)
            }
          }
        }
      } catch {
        localStorage.removeItem('deliverex_user')
        localStorage.removeItem('deliverex_token')
      } finally {
        if (!cancelled) {
          setBootstrapped(true)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback((nextUser, nextToken) => {
    localStorage.setItem('deliverex_token', nextToken)
    localStorage.setItem('deliverex_user', JSON.stringify(nextUser))
    setUser(nextUser)
    setToken(nextToken)
  }, [])

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      localStorage.setItem('deliverex_user', JSON.stringify(next))
      return next
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem('deliverex_token')) {
        await logoutApi()
      }
    } catch {
      // Ignore network errors — still clear local session.
    }
    localStorage.removeItem('deliverex_token')
    localStorage.removeItem('deliverex_user')
    setUser(null)
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role?.name ?? null,
      isAuthenticated: Boolean(user && token),
      bootstrapped,
      login,
      logout,
      updateUser,
    }),
    [user, token, bootstrapped, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
