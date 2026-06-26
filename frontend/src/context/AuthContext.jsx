import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getProfile, logout as logoutApi } from '../api/auth'
import SessionManager, { SESSION_EXPIRED_EVENT } from '../services/session/SessionManager'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const rawUser = localStorage.getItem('deliverex_user')
        const savedToken = SessionManager.getAccessToken()
        if (rawUser) {
          setUser(JSON.parse(rawUser))
        }
        if (savedToken) {
          setToken(savedToken)

          // FR 1.21 — if access token expired, try silent refresh before /auth/me.
          if (SessionManager.isAccessTokenExpiringSoon(0)) {
            try {
              await SessionManager.refreshAccessToken()
            } catch {
              if (!cancelled) {
                SessionManager.clear()
                setUser(null)
                setToken(null)
                setSessionExpired(true)
              }
              return
            }
          }

          try {
            const me = await getProfile()
            if (!cancelled && me) {
              setUser(me)
              localStorage.setItem('deliverex_user', JSON.stringify(me))
            }
          } catch {
            try {
              await SessionManager.refreshAccessToken()
              const me = await getProfile()
              if (!cancelled && me) {
                setUser(me)
                localStorage.setItem('deliverex_user', JSON.stringify(me))
                setToken(SessionManager.getAccessToken())
              }
            } catch {
              if (!cancelled) {
                SessionManager.clear()
                setUser(null)
                setToken(null)
                setSessionExpired(true)
              }
            }
          }
        }
      } catch {
        SessionManager.clear()
      } finally {
        if (!cancelled) {
          setBootstrapped(true)
        }
      }
    }

    bootstrap()

    const onExpired = () => {
      setUser(null)
      setToken(null)
      setSessionExpired(true)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)

    return () => {
      cancelled = true
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
    }
  }, [])

  const login = useCallback(async (nextUser, nextToken, sessionPayload = {}) => {
    await SessionManager.persist({
      token: nextToken,
      user: nextUser,
      ...sessionPayload,
    })
    setSessionExpired(false)
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
      if (SessionManager.getAccessToken()) {
        await logoutApi()
      }
    } catch {
      // Ignore network errors — still clear local session.
    }
    SessionManager.clear()
    setUser(null)
    setToken(null)
    setSessionExpired(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role?.name ?? null,
      isAuthenticated: Boolean(user && token),
      bootstrapped,
      sessionExpired,
      login,
      logout,
      updateUser,
      clearSessionExpired: () => setSessionExpired(false),
    }),
    [user, token, bootstrapped, sessionExpired, login, logout, updateUser],
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
