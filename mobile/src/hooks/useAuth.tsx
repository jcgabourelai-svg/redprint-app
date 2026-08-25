import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import api from '../lib/api'
import type { AuthUser } from '../types/api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  hasPermission: (permiso: string) => boolean
  login: (correo: string, contrasena: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<AuthUser>('/auth/user')
      .then((res) => {
        if (!cancelled) setUser(res.data)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function login(correo: string, contrasena: string) {
    await api.post('/auth/login', { correo, contrasena })
    const res = await api.get<AuthUser>('/auth/user')
    setUser(res.data)
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      void 0
    }
    setUser(null)
  }

  const hasPermission = useCallback(
    (permiso: string) => user?.permisos.includes(permiso) ?? false,
    [user]
  )

  const value = useMemo(
    () => ({ user, loading, hasPermission, login, logout }),
    [user, loading, hasPermission]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
