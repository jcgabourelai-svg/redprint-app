import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Notification } from '@/types/admin'
import type { PaginatedResponse } from '@/types/api'

export function useNotifications(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: ['notifications', params],
    queryFn: () => api.get('/notifications', { params }).then(r => r.data),
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all').then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}