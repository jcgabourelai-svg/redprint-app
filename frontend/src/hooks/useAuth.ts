import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User } from '@/types/models'

export function useAuth() {
  const queryClient = useQueryClient()

  const userQuery = useQuery<User>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await api.get('/auth/user')
      return data
    },
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: { correo: string; contrasena: string }) => {
      const { data } = await api.post('/auth/login', credentials)
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
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'user'], null)
    },
  })

  return {
    user: userQuery.data ?? null,
    isAuthenticated: !!userQuery.data,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoading: userQuery.isLoading,
  }
}
