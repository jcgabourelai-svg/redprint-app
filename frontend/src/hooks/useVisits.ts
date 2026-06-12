import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Visit, PaginatedResponse } from '@/types/models'

export function useVisits(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Visit>>({
    queryKey: ['visits', params],
    queryFn: () => api.get('/visits', { params }).then(r => r.data),
  })
}

export function useVisit(id: number) {
  return useQuery<Visit>({
    queryKey: ['visits', id],
    queryFn: () => api.get(`/visits/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/visits', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['visits'] }) },
  })
}

export function useCompleteVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.post(`/visits/${id}/complete`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['visits'] })
      qc.invalidateQueries({ queryKey: ['visits', id] })
    },
  })
}

export function useRescheduleVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.post(`/visits/${id}/reschedule`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['visits'] })
      qc.invalidateQueries({ queryKey: ['visits', id] })
    },
  })
}
