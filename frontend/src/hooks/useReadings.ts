import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Reading, PaginatedResponse } from '@/types/models'

export function useReadings(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Reading>>({
    queryKey: ['readings', params],
    queryFn: () => api.get('/readings', { params }).then(r => r.data),
  })
}

export function useReadingsByVisit(visitId: number) {
  return useQuery<PaginatedResponse<Reading>>({
    queryKey: ['readings', 'visit', visitId],
    queryFn: () => api.get('/readings', { params: { visit_id: visitId } }).then(r => r.data),
    enabled: !!visitId,
  })
}

export function useReadingsByPrinter(printerId: number) {
  return useQuery<PaginatedResponse<Reading>>({
    queryKey: ['readings', 'printer', printerId],
    queryFn: () => api.get('/readings', { params: { printer_id: printerId } }).then(r => r.data),
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
