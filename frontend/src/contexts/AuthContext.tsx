import { createContext, useContext, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User } from '@/types/admin'

interface AuthContextType {
  user: User | null | undefined
  isLoading: boolean
  error: Error | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface LoginResponse {
  user: User
  token?: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isLoading, error } = useQuery<User | null, Error>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await api.get<User>('/auth/user')
      return data
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: { correo: string; contrasena: string }) => {
      const { data } = await api.post<LoginResponse>('/auth/login', credentials)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
  })

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({
      correo: email,
      contrasena: password,
    })
  }

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync()
    } finally {
      queryClient.clear()
    }
  }

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useIsAdmin() {
  const { user } = useAuth()
  return user?.rol === 'ADMIN'
}