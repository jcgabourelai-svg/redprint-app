import type { MaintenanceType, MaintenanceStatus } from './enums'

export interface MaintenanceOrder {
  id: number
  impresora_id: number
  printer?: {
    id: number
    marca: string
    modelo: string
  }
  fecha: string | null
  tipo_mantto: MaintenanceType
  desc_problema: string | null
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
