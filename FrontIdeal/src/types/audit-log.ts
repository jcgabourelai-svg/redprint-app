export interface AuditLog {
  id: string
  usuario_id: string
  usuario_nombre: string
  accion: string
  modelo: string
  modelo_id: string
  cambios?: Record<string, { antes: unknown, despues: unknown }>
  fecha: string
  ip_address?: string
  user_agent?: string
}