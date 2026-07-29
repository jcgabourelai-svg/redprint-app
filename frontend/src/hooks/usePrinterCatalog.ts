import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PrinterBrand, PrinterModel } from '@/types/printer-model'

export interface PrinterModelOption {
  value: string
  label: string
}

/**
 * Construye las opciones "{marca} {modelo}" para un MultiSelect/Select a partir
 * de la lista de marcas (con sus modelos anidados). Único punto de formato del
 * label de modelo-compatible para crear/editar artículos.
 */
export function buildPrinterModelOptions(brands: PrinterBrand[] | undefined): PrinterModelOption[] {
  const opts: PrinterModelOption[] = []
  ;(brands ?? []).forEach((b) => {
    ;(b.modelos ?? []).forEach((m) => {
      opts.push({ value: String(m.id), label: `${b.nombre} ${m.nombre}` })
    })
  })
  return opts
}

export function usePrinterBrands(withModelos = false) {
  return useQuery<PrinterBrand[]>({
    queryKey: ['printer-brands', { withModelos }],
    queryFn: () =>
      api
        .get('/printer-brands', {
          params: withModelos ? { with: 'modelos' } : {},
        })
        .then((r) => r.data),
  })
}

export function usePrinterModels(brandId?: number) {
  return useQuery<PrinterModel[]>({
    queryKey: ['printer-models', { brandId }],
    queryFn: () =>
      api
        .get('/printer-models', { params: brandId ? { brand_id: brandId } : {} })
        .then((r) => r.data),
  })
}

export function useCreatePrinterBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { nombre: string }) =>
      api.post('/printer-brands', data).then((r) => r.data as PrinterBrand),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-brands'] })
      qc.invalidateQueries({ queryKey: ['printer-models'] })
    },
  })
}

export function useCreatePrinterModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { brand_id: number; nombre: string }) =>
      api.post('/printer-models', data).then((r) => r.data as PrinterModel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-brands'] })
      qc.invalidateQueries({ queryKey: ['printer-models'] })
    },
  })
}
