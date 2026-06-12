import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Payment } from '@/types/payment'
import type { PaginatedResponse } from '@/types/api'

export function usePayments(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Payment>>({
    queryKey: ['payments', params],
    queryFn: () => api.get('/payments', { params }).then(r => r.data),
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/payments', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}