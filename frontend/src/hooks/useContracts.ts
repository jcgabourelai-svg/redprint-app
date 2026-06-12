import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Contract, PaginatedResponse } from '@/types/models'

export function useContracts(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Contract>>({
    queryKey: ['contracts', params],
    queryFn: () => api.get('/contracts', { params }).then(r => r.data),
  })
}

export function useContract(id: number) {
  return useQuery<Contract>({
    queryKey: ['contracts', id],
    queryFn: () => api.get(`/contracts/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/contracts', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }) },
  })
}

export function useAssignPrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.post(`/contracts/${id}/assign-printer`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
    },
  })
}
