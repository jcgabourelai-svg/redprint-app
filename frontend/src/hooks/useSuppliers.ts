import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Supplier, PaginatedResponse } from '@/types/models'

export function useSuppliers(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Supplier>>({
    queryKey: ['suppliers', params],
    queryFn: () => api.get('/suppliers', { params }).then(r => r.data),
  })
}

export function useSupplier(id: number) {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: () => api.get(`/suppliers/${id}`).then(r => r.data),
    enabled: !!id,
  })
}
