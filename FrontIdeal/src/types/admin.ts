import type { UserRole } from './enums'

export interface User {
  id: string
  nombre: string
  email: string
  rol: UserRole
  activo: boolean
  fecha_creacion: string
  ultimo_acceso?: string
}

export interface Notification {
  id: string
  tipo: 'alerta' | 'warning' | 'recordatorio' | 'info' | 'exito'
  mensaje: string
  fecha: string
  hora: string
  leida: boolean
  accion?: {
    texto: string
    link: string
  }
  categoria?: 'inventario' | 'finanzas' | 'operaciones' | 'general'
}