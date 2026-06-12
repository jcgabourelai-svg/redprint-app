import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ProfitabilityData, ClientProfitability, CashFlowData } from '@/types/finance-reports'

export function useProfitabilityReport(params?: Record<string, string>) {
  return useQuery<ProfitabilityData[]>({
    queryKey: ['reports', 'profitability', params],
    queryFn: () => api.get('/reports/finance/profitability', { params }).then(r => r.data),
  })
}

export function useClientProfitabilityReport(params?: Record<string, string>) {
  return useQuery<ClientProfitability[]>({
    queryKey: ['reports', 'client-profitability', params],
    queryFn: () => api.get('/reports/finance/client-profitability', { params }).then(r => r.data),
  })
}

export function useCashFlowReport(params?: Record<string, string>) {
  return useQuery<CashFlowData[]>({
    queryKey: ['reports', 'cash-flow', params],
    queryFn: () => api.get('/reports/finance/cash-flow', { params }).then(r => r.data),
  })
}