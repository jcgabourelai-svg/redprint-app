import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Reading } from '@/types/reading'
import type { PaginatedResponse } from '@/types/api'

export function useReadings(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Reading>>({
    queryKey: ['readings', params],
    queryFn: () => api.get('/readings', { params }).then(r => r.data),
  })
}

export function useVisitReadings(visitId: number) {
  return useQuery<PaginatedResponse<Reading>>({
    queryKey: ['readings', 'visit', visitId],
    queryFn: () => api.get('/readings', { params: { visita_id: visitId } }).then(r => r.data),
    enabled: !!visitId,
  })
}

export function usePrinterReadings(printerId: number) {
  return useQuery<PaginatedResponse<Reading>>({
    queryKey: ['readings', 'printer', printerId],
    queryFn: () => api.get('/readings', { params: { impresora_id: printerId } }).then(r => r.data),
    enabled: !!printerId,
  })
}

export function useCreateReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/readings', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['readings'] }) },
  })
}