import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { TonerEstimados, TonerPanelData } from '@/types/api'

/** Panel "tóner bajo" (estimado) — requiere operaciones.lecturas en backend. */
export function useTonerPanel(enabled = true) {
  return useQuery<TonerPanelData>({
    queryKey: ['toner', 'panel'],
    queryFn: () => api.get('/toner/panel').then(r => r.data),
    enabled,
  })
}

/** Estimados + cambios detectados de una impresora — requiere inventario.impresoras. */
export function usePrinterToner(printerId: number, enabled = true) {
  return useQuery<TonerEstimados>({
    queryKey: ['toner', 'printer', printerId],
    queryFn: () => api.get(`/printers/${printerId}/toner`).then(r => r.data),
    enabled: enabled && Number.isFinite(printerId) && printerId > 0,
  })
}
