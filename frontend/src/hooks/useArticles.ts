import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Article } from '@/types/article'
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

export function useArticleCompatiblePrinters(articleId: number) {
  return useQuery({
    queryKey: ['articles', articleId, 'compatible-printers'],
    queryFn: () => api.get(`/articles/${articleId}/compatible-printers`).then(r => r.data),
    enabled: !!articleId,
  })
}