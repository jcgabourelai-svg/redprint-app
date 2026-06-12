import type { ApiError } from '@/types/api'

export function parseApiError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Error desconocido'
  const axiosError = error as { response?: { status?: number; data?: ApiError } }
  if (axiosError.response) {
    const { status, data } = axiosError.response
    if (status === 401) return 'Sesión expirada. Inicie sesión nuevamente.'
    if (status === 403) return getForbiddenMessage()
    if (status === 404) return 'Recurso no encontrado.'
    if (status === 422 && data?.errors) {
      return Object.values(data.errors).flat().join('. ')
    }
    return data?.message || `Error del servidor (${status})`
  }
  return 'Error de conexión. Verifique su red.'
}

export function getForbiddenMessage(): string {
  return 'No tiene permisos para realizar esta acción.'
}