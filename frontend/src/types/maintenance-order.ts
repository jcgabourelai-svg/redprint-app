import type { MaintenanceType, MaintenanceStatus } from './enums'

export interface MaintenanceOrder {
  id: number
  impresora_id: number
  printer?: {
    id: number
    marca: string
    modelo: string
    estado?: string | null
    cliente?: { id: number; nombre: string; contrato_id?: number; contrato_codigo?: string } | null
    warehouse?: { id: number; nombre: string } | null
  }
  fecha: string | null
  proxima_visita?: { id: number; fecha_programada: string; tipo_visita?: string | null } | null
  tipo_mantto: MaintenanceType
  desc_problema: string | null
  tipo_problema: string | null
  severidad: string | null
  trabajo_realizado: string | null
  costo_mano_obra: number
  costo_total: number
  socio_id: number
  socio?: {
    id: number
    nombre: string
  }
  visita_id: number | null
  estado: MaintenanceStatus
  articles_used?: ArticleUsed[]
  fecha_creacion: string | null
  fecha_completado?: string | null
  foto_evidencia?: string | null
}

export interface ArticleUsed {
  id: number
  articulo_id: number
  article?: {
    id: number
    nombre: string
    costo_unitario: number
  }
  cantidad: number
  costo_unitario: number
  subtotal: number
}
