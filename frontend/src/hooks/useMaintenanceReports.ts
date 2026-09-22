import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useProblematicPrinters(limit = 10) {
  return useQuery({
    queryKey: ['reports', 'maintenance', 'problematic-printers', limit],
    queryFn: () => api.get('/reports/maintenance/problematic-printers', { params: { limit } }).then(r => r.data),
  })
}

export function usePrinterMaintenanceCost(printerId: string) {
  return useQuery({
    queryKey: ['reports', 'maintenance', 'printer', printerId, 'cost'],
    queryFn: () => api.get(`/reports/maintenance/printer/${printerId}/cost`).then(r => r.data),
    enabled: !!printerId,
  })
}

export interface TopUsedArticle {
  articulo_id: number
  nombre: string
  tipo_articulo: string
  total_cantidad: number
  total_costo: number
}

export interface TopArticlesResponse {
  top: TopUsedArticle[]
  por_origen: Record<string, { total_cantidad: number; total_costo: number }>
}

export interface FailureRankingRow {
  tipo_problema: string
  modelo_id: number | null
  marca: string | null
  modelo: string | null
  total: number
  costo_total: number
}

export interface FailureRankingResponse {
  ranking: FailureRankingRow[]
  piezas_asociadas: Record<string, { articulo_id: number; nombre: string; total_cantidad: number; total_costo: number }[]>
}

export function useTopArticles(params?: { fecha_desde?: string; fecha_hasta?: string; tipo_articulo?: string; limit?: number }) {
  return useQuery<TopArticlesResponse>({
    queryKey: ['reports', 'maintenance', 'top-articles', params ?? {}],
    queryFn: () => api.get('/reports/maintenance/top-articles', { params }).then(r => r.data),
  })
}

export function useFailures(params?: { fecha_desde?: string; fecha_hasta?: string }) {
  return useQuery<FailureRankingResponse>({
    queryKey: ['reports', 'maintenance', 'failures', params ?? {}],
    queryFn: () => api.get('/reports/maintenance/failures', { params }).then(r => r.data),
  })
}