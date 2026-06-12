import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PrinterExpense, PaginatedResponse } from '@/types/models'

export function usePrinterExpenses(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<PrinterExpense>>({
    queryKey: ['printer-expenses', params],
    queryFn: () => api.get('/printer-expenses', { params }).then(r => r.data),
  })
}

export function useCreatePrinterExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/printer-expenses', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-expenses'] })
    },
  })
}
