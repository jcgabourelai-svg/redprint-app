import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Client, PaginatedResponse } from '@/types/models'

export function useClients(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients', params],
    queryFn: () => api.get('/clients', { params }).then(r => r.data),
  })
}

export function useClient(id: number) {
  return useQuery<Client>({
    queryKey: ['clients', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/clients', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }) },
  })
}
