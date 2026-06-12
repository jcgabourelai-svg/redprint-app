import type { MovementType } from './enums'

export type MovementReason = 'compra' | 'devolucion' | 'ajuste' | 'traslado' | 'consumo' | 'mantenimiento' | 'venta' | 'perdida'
export type MovementStatus = 'completado' | 'pendiente' | 'cancelado'

export interface InventoryMovement {
  id: string
  tipo: MovementType
  articulo_id: string
  articulo_nombre: string
  almacen_id: string
  almacen_nombre: string
  cantidad: number
  fecha: string
  motivo: MovementReason
  estado: MovementStatus
  responsable: string
  referencia?: string
  notas?: string
  costo_unitario?: number
}