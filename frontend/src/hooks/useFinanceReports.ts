import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useProfitabilityReport(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['reports', 'profitability', params],
    queryFn: () => api.get('/reports/finance/profitability', { params }).then(r => r.data),
  })
}

export function useCashFlowReport(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['reports', 'cash-flow', params],
    queryFn: () => api.get('/reports/finance/cash-flow', { params }).then(r => r.data),
  })
}
