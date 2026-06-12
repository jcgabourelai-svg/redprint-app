import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BankMovement } from '@/types/models'
import type { PaginatedResponse } from '@/types/api'

export function useReconciliationMovements(accountId: number, periodo: string) {
  return useQuery<PaginatedResponse<BankMovement>>({
    queryKey: ['reconciliation', accountId, periodo],
    queryFn: () => api.get('/reconciliation/movements', { params: { account_id: accountId, periodo } }).then(r => r.data),
    enabled: !!accountId && !!periodo,
  })
}

export function useLinkMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/reconciliation/link', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation'] }) },
  })
}

export function useReconciliationSummary(accountId: number, periodo: string) {
  return useQuery({
    queryKey: ['reconciliation', 'summary', accountId, periodo],
    queryFn: () => api.get('/reconciliation/summary', { params: { account_id: accountId, periodo } }).then(r => r.data),
    enabled: !!accountId && !!periodo,
  })
}
