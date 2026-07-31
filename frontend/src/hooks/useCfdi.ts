import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiUpload } from '@/lib/api'
import type { XmlComprobante, CfdiImportResultItem } from '@/types/cfdi'
import type { Invoice } from '@/types/invoice'

export function useCfdiDetail(id?: number) {
  return useQuery<XmlComprobante>({
    queryKey: ['cfdi', id],
    queryFn: () => api.get(`/cfdi/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

/**
 * Importa uno o varios XML (multipart). Invalida comprobantes y facturas
 * (porque la importacion puede auto-enlazar facturas existentes).
 */
export function useImportCfdi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData()
      files.forEach((f) => form.append('archivos[]', f))
      return apiUpload<{ resultados: CfdiImportResultItem[] }>('/cfdi/import', form)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cfdi'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useGenerateInvoiceFromCfdi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: number; fecha_vencimiento?: string; notas?: string }) =>
      api.post<Invoice>(`/cfdi/${id}/factura`, payload).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['cfdi'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['cfdi', id] })
    },
  })
}

export function useLinkCfdi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, invoiceId }: { id: number; invoiceId: number }) =>
      api.post(`/cfdi/${id}/vincular`, { invoice_id: invoiceId }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['cfdi'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['cfdi', id] })
    },
  })
}

export function useUnlinkCfdi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/cfdi/${id}/vincular`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['cfdi'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['cfdi', id] })
    },
  })
}

export function useAssignCfdiClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: number; cliente_id?: number | null; notas?: string }) =>
      api.patch(`/cfdi/${id}`, payload).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['cfdi'] })
      qc.invalidateQueries({ queryKey: ['cfdi', id] })
    },
  })
}

export function useDeleteCfdi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cfdi/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cfdi'] })
    },
  })
}
