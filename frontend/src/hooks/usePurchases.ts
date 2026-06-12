import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Purchase, PaginatedResponse } from '@/types/models'

export function usePurchases(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Purchase>>({
    queryKey: ['purchases', params],
    queryFn: () => api.get('/purchases', { params }).then(r => r.data),
  })
}

export function usePurchase(id: number) {
  return useQuery<Purchase>({
    queryKey: ['purchases', id],
    queryFn: () => api.get(`/purchases/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/purchases', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }) },
  })
}

export function useReceivePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/purchases/${id}/receive`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useCancelPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/purchases/${id}/cancel`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }) },
  })
}
