import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BankMovement } from '@/types/bank-movement'
import type { BankAccount } from '@/types/bank-account'
import type { PaginatedResponse } from '@/types/api'

export function useBankAccounts(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<BankAccount>>({
    queryKey: ['bank-accounts', params],
    queryFn: () => api.get('/bank-accounts', { params }).then(r => r.data),
  })
}

export function useBankMovements(accountId: string, params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<BankMovement>>({
    queryKey: ['bank-accounts', accountId, 'movements', params],
    queryFn: () => api.get(`/bank-accounts/${accountId}/movements`, { params }).then(r => r.data),
    enabled: !!accountId,
  })
}

export function useCreateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/bank-accounts', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }) },
  })
}