import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User, PaginatedResponse } from '@/types/models'

export function useUsers(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', params],
    queryFn: () => api.get('/users', { params }).then(r => r.data),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/users', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }) },
  })
}
