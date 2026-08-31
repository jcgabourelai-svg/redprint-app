import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Invoice, InvoiceCalculation } from '@/types/invoice'
import type { PaginatedResponse } from '@/types/api'

export function useInvoices(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: ['invoices', params],
    queryFn: () => api.get('/invoices', { params }).then(r => r.data),
  })
}

export function useInvoice(id: number) {
  return useQuery<Invoice>({
    queryKey: ['invoices', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/invoices', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })
}

export interface DraftResponse {
  id: number
  [key: string]: unknown
}

export function useCreateInvoiceDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { cliente_id: number; periodo_inicio: string; periodo_fin: string; notas?: string }) =>
      api
        .post<{ data: DraftResponse; advertencias: string[] }>('/invoices/draft', data)
        .then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })
}

export function useEmitInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number | string; numero_factura: string; fecha_emision: string }) =>
      api.post(`/invoices/${id}/emitir`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

export function useRecalcInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) =>
      api.post(`/invoices/${id}/recalcular`).then(r => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => api.delete(`/invoices/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.put(`/invoices/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoices', id] })
    },
  })
}

export function useInvoiceCalculation(
  clienteId: string,
  periodoInicio: string,
  periodoFin: string,
  enabled: boolean,
) {
  return useQuery<InvoiceCalculation>({
    queryKey: ['invoice-calc', clienteId, periodoInicio, periodoFin],
    queryFn: () =>
      api
        .get('/invoices/calcular', {
          params: { cliente_id: clienteId, periodo_inicio: periodoInicio, periodo_fin: periodoFin },
        })
        .then((r) => r.data),
    enabled: enabled && !!clienteId && !!periodoInicio && !!periodoFin,
  })
}