import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { InventoryMovement, PaginatedResponse } from '@/types/models'

export function useInventoryMovements(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<InventoryMovement>>({
    queryKey: ['inventory-movements', params],
    queryFn: () => api.get('/inventory-movements', { params }).then(r => r.data),
  })
}
