import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FieldRecord, LinkFieldRecordPayload } from '@/types/field-record'
import type { PaginatedResponse } from '@/types/api'

export function useFieldRecords(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<FieldRecord>>({
    queryKey: ['field-records', params],
    queryFn: () => api.get('/field-records', { params }).then(r => r.data),
  })
}

export function useFieldRecord(id: number | null) {
  return useQuery<FieldRecord>({
    queryKey: ['field-records', 'detail', id],
    queryFn: () => api.get(`/field-records/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

/** Total de registros PENDIENTES (para el KPI de la bandeja y el dashboard). */
export function usePendingFieldRecordsCount() {
  return useQuery<PaginatedResponse<FieldRecord>>({
    queryKey: ['field-records', 'pendientes'],
    queryFn: () => api.get('/field-records', { params: { estado: 'PENDIENTE', per_page: 1 } }).then(r => r.data),
  })
}

export function useLinkFieldRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: LinkFieldRecordPayload }) =>
      api.post<FieldRecord>(`/field-records/${id}/link`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-records'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDiscardFieldRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      api.post<FieldRecord>(`/field-records/${id}/discard`, { motivo_descarte: motivo }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-records'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
