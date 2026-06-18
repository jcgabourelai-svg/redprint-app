import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User } from '@/types/admin'
import type { PaginatedResponse } from '@/types/api'

function mapUser(raw: any): User {
  return {
    id: String(raw.id),
    nombre: raw.nombre,
    email: raw.correo ?? raw.email,
    rol: raw.rol,
    activo: raw.activo,
    fecha_creacion: raw.fecha_creacion,
    ultimo_acceso: raw.ultimo_acceso,
  }
}

export function useUsers(params?: Record<string, string | number>) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', params],
    queryFn: async () => {
      const res = await api.get('/users', { params })
      const payload = res.data
      if (Array.isArray(payload?.data)) {
        payload.data = payload.data.map(mapUser)
      }
      return payload
    },
  })
}

export type CreateUserInput = {
  nombre: string
  email: string
  password: string
  rol: 'ADMIN' | 'OPERADOR'
  activo?: boolean
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & { activo?: boolean }

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      api
        .post('/users', {
          nombre: input.nombre,
          correo: input.email,
          contrasena: input.password,
          rol: input.rol,
          activo: input.activo,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: string }) =>
      api
        .put(`/users/${id}`, {
          nombre: input.nombre,
          correo: input.email,
          rol: input.rol,
          activo: input.activo,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useResetUserPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; password: string }) =>
      api.post(`/users/${data.id}/reset-password`, { password: data.password }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
