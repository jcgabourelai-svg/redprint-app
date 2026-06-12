import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User } from '@/types/admin'
import type { PaginatedResponse } from '@/types/api'

export function useUsers(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', params],
    queryFn: () => api.get('/users', { params }).then(r => r.data),
  })
}

export function useResetUserPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; password: string }) => api.post(`/users/${data.id}/reset-password`, { password: data.password }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }) },
  })
}