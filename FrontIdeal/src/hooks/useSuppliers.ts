import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Supplier } from '@/types/supplier'
import type { PaginatedResponse } from '@/types/api'

export function useSuppliers(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Supplier>>({
    queryKey: ['suppliers', params],
    queryFn: () => api.get('/suppliers', { params }).then(r => r.data),
  })
}

export function useSupplier(id: string) {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: () => api.get(`/suppliers/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/suppliers', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }) },
  })
}