import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { InventoryMovement } from '@/types/inventory-movement'
import type { PaginatedResponse } from '@/types/api'

export function useInventoryMovements(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<InventoryMovement>>({
    queryKey: ['inventory-movements', params],
    queryFn: () => api.get('/inventory-movements', { params }).then(r => r.data),
  })
}

export function useInventoryMovement(id: number) {
  return useQuery<InventoryMovement>({
    queryKey: ['inventory-movements', id],
    queryFn: () => api.get(`/inventory-movements/${id}`).then(r => r.data),
    enabled: !!id,
  })
}