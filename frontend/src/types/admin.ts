export interface User {
  id: string
  nombre: string
  email: string
  rol_id?: string | number
  rol_nombre?: string
  rol_slug?: string
  es_sistema?: boolean
  permisos?: string[]
  /** @deprecated usar rol_nombre / es_sistema */
  rol?: string
  activo: boolean
  fecha_creacion: string
  ultimo_acceso?: string
}

export interface Notification {
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

export interface Role {
  id: string
  nombre: string
  slug: string
  descripcion?: string | null
  es_sistema: boolean
  permisos: string[]
  permisos_count?: number
}

export type PermisosCatalogo = Record<string, { clave: string; etiqueta: string }[]>
