import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SupplierPaymentModel, PaginatedResponse } from '@/types/models'

export function useSupplierPayments(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<SupplierPaymentModel>>({
    queryKey: ['supplier-payments', params],
    queryFn: () => api.get('/supplier-payments', { params }).then(r => r.data),
  })
}

export function useCreateSupplierPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/supplier-payments', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-payments'] })
      qc.invalidateQueries({ queryKey: ['purchases'] })
    },
  })
}
