import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Invoice, PaginatedResponse } from '@/types/models'

export function useInvoices(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: ['invoices', params],
    queryFn: () => api.get('/invoices', { params }).then(r => r.data),
  })
}

export function useInvoice(id: number) {
  return useQuery<Invoice>({
    queryKey: ['invoices', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/invoices', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })
}
