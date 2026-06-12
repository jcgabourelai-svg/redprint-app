import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Printer } from '@/types/printer'
import type { PaginatedResponse } from '@/types/api'

export function usePrinters(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Printer>>({
    queryKey: ['printers', params],
    queryFn: () => api.get('/printers', { params }).then(r => r.data),
  })
}

export function usePrinter(id: number) {
  return useQuery<Printer>({
    queryKey: ['printers', id],
    queryFn: () => api.get(`/printers/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreatePrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/printers', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['printers'] }) },
  })
}

export function useUpdatePrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.put(`/printers/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['printers'] })
      qc.invalidateQueries({ queryKey: ['printers', id] })
    },
  })
}