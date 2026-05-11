import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { logout as logoutApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('deliverex_user')
      const savedToken = localStorage.getItem('deliverex_token')
      if (rawUser) {
        setUser(JSON.parse(rawUser))
      }
      if (savedToken) {
        setToken(savedToken)
      }
    } catch {
      localStorage.removeItem('deliverex_user')
      localStorage.removeItem('deliverex_token')
    } finally {
      setBootstrapped(true)
    }
  }, [])

  const login = useCallback((nextUser, nextToken) => {
    localStorage.setItem('deliverex_token', nextToken)
    localStorage.setItem('deliverex_user', JSON.stringify(nextUser))
    setUser(nextUser)
    setToken(nextToken)
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
    }),
    [user, token, bootstrapped, login, logout],
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
