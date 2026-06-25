import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Role, PermisosCatalogo } from '@/types/admin'

function mapRole(raw: any): Role {
  return {
    id: String(raw.id),
    nombre: raw.nombre,
    slug: raw.slug,
    descripcion: raw.descripcion ?? null,
    es_sistema: !!raw.es_sistema,
    permisos: raw.permisos ?? (raw.permisos_count != null ? [] : []),
    permisos_count: raw.permisos_count ?? (raw.permisos ?? []).length,
  }
}

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles')
      const payload = res.data
      const list = Array.isArray(payload?.data) ? payload.data : payload
      return (list ?? []).map(mapRole)
    },
  })
}

export function usePermisosCatalog() {
  return useQuery<PermisosCatalogo>({
    queryKey: ['permisos-catalog'],
    queryFn: async () => {
      const res = await api.get('/permisos')
      return res.data as PermisosCatalogo
    },
    staleTime: 10 * 60 * 1000,
  })
}

export type RoleInput = {
  nombre: string
  descripcion?: string | null
  permisos: string[]
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoleInput) => api.post('/roles', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: RoleInput & { id: string }) =>
      api.put(`/roles/${id}`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}
