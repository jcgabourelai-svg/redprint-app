import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PeriodClose } from '@/types/period-close'
import type { PaginatedResponse } from '@/types/api'

export function useCurrentPeriod() {
  return useQuery<PeriodClose>({
    queryKey: ['period', 'current'],
    queryFn: () => api.get('/periods/current').then(r => r.data),
  })
}

export function usePeriodHistory(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<PeriodClose>>({
    queryKey: ['periods', 'history', params],
    queryFn: () => api.get('/periods/history', { params }).then(r => r.data),
  })
}

export function useClosePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/periods/close', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period'] })
      qc.invalidateQueries({ queryKey: ['periods'] })
    },
  })
}