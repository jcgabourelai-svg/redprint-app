import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Warehouse, WarehouseDetail } from '@/types/warehouse'
import type { PaginatedResponse } from '@/types/api'

export function useWarehouses(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Warehouse>>({
    queryKey: ['warehouses', params],
    queryFn: () => api.get('/warehouses', { params }).then(r => r.data),
  })
}

export function useWarehouse(id: number) {
  return useQuery<WarehouseDetail>({
    queryKey: ['warehouses', id],
    queryFn: () => api.get(`/warehouses/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/warehouses', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }) },
  })
}

export function useDeleteWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }) },
  })
}

export function useWarehousePrinters(warehouseId: number) {
  return useQuery({
    queryKey: ['warehouses', warehouseId, 'printers'],
    queryFn: () => api.get(`/warehouses/${warehouseId}/printers`).then(r => r.data),
    enabled: !!warehouseId,
  })
}