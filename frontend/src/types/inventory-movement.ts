import type { MovementType } from './enums'

export type { MovementType }

export interface InventoryMovementArticle {
  id: number
  nombre: string
  modelo_sku?: string | null
  marca?: string | null
  stock_actual?: number | null
}

export interface InventoryMovementSocio {
  id: number
  nombre: string
  correo?: string | null
}

export interface InventoryMovement {
  id: number
  articulo_id: number
  article: InventoryMovementArticle | null
  tipo_movimiento: MovementType
  cantidad: number
  stock_anterior: number
  stock_posterior: number
  referencia_tipo: string | null
  referencia_id: number | null
  justificacion: string | null
  fecha: string
  socio: InventoryMovementSocio | null
  fecha_creacion: string
}
