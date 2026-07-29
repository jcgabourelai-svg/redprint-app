import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Article } from '@/types/article'
import type { PrinterModel } from '@/types/printer-model'
import type { InventoryMovement } from '@/types/inventory-movement'
import type { PaginatedResponse } from '@/types/api'

export function useArticles(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<Article>>({
    queryKey: ['articles', params],
    queryFn: () => api.get('/articles', { params }).then(r => r.data),
  })
}

export function useArticle(id: number) {
  return useQuery<Article>({
    queryKey: ['articles', id],
    queryFn: () => api.get(`/articles/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/articles', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['articles'] }) },
  })
}

export function useUpdateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.put(`/articles/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['articles'] })
      qc.invalidateQueries({ queryKey: ['articles', id] })
    },
  })
}

export function useArticleMovements(articleId: number) {
  return useQuery<PaginatedResponse<InventoryMovement>>({
    queryKey: ['articles', articleId, 'movements'],
    queryFn: () => api.get(`/articles/${articleId}/movements`).then(r => r.data),
    enabled: !!articleId,
  })
}

export function useCreateArticleMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ articleId, ...data }: { articleId: number } & Record<string, unknown>) =>
      api.post(`/articles/${articleId}/movements`, data).then(r => r.data),
    onSuccess: (_, { articleId }) => {
      qc.invalidateQueries({ queryKey: ['articles', articleId] })
      qc.invalidateQueries({ queryKey: ['articles', articleId, 'movements'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
    },
  })
}

export function useArticleCompatibleModels(articleId: number) {
  return useQuery<PrinterModel[]>({
    queryKey: ['articles', articleId, 'compatible-models'],
    queryFn: () => api.get(`/articles/${articleId}/compatible-models`).then(r => r.data),
    enabled: !!articleId,
  })
}

export function useDeactivateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.delete(`/articles/${id}`, { data: { reason } }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['articles'] })
      qc.invalidateQueries({ queryKey: ['articles', id] })
    },
  })
}