import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { MaintenanceOrder } from '@/types/maintenance-order'
import type { PaginatedResponse } from '@/types/api'

export function useMaintenanceOrders(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<MaintenanceOrder>>({
    queryKey: ['maintenance-orders', params],
    queryFn: () => api.get('/maintenance-orders', { params }).then(r => r.data),
  })
}

export function useMaintenanceOrder(id: number) {
  return useQuery<MaintenanceOrder>({
    queryKey: ['maintenance-orders', id],
    queryFn: () => api.get(`/maintenance-orders/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateMaintenanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/maintenance-orders', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}

export function useUpdateMaintenanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.put(`/maintenance-orders/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['maintenance-orders', id] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}

export function useCompleteMaintenanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.post(`/maintenance-orders/${id}/complete`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['maintenance-orders', id] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}

export function useCancelMaintenanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/maintenance-orders/${id}/cancel`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}

export function useDeleteMaintenanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/maintenance-orders/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}

export function useAddArticleToMaintenance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }: { orderId: number } & Record<string, unknown>) =>
      api.post(`/maintenance-orders/${orderId}/articles`, data).then(r => r.data),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders', orderId] })
    },
  })
}

export function useRemoveArticleFromMaintenance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, articleUsedId }: { orderId: number; articleUsedId: number }) =>
      api.delete(`/maintenance-orders/${orderId}/articles/${articleUsedId}`).then(r => r.data),
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders', orderId] })
    },
  })
}