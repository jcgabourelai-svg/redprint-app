import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useProviderMetrics() {
  return useQuery({
    queryKey: ['reports', 'maintenance', 'providers'],
    queryFn: () => api.get('/reports/maintenance/providers').then(r => r.data),
  })
}

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