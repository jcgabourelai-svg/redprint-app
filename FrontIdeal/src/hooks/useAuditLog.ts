import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AuditLog } from '@/types/audit-log'
import type { PaginatedResponse } from '@/types/api'

export function useAuditLog(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit-log', params],
    queryFn: () => api.get('/audit-log', { params }).then(r => r.data),
  })
}

export function useAuditLogEntry(id: string) {
  return useQuery<AuditLog>({
    queryKey: ['audit-log', id],
    queryFn: () => api.get(`/audit-log/${id}`).then(r => r.data),
    enabled: !!id,
  })
}