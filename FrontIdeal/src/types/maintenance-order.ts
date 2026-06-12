import type { MaintenanceType, MaintenanceStatus } from './enums'

export interface MaintenanceOrder {
  id: string
  impresora_id: string
  impresora_marca: string
  impresora_modelo: string
  fecha: string
  tipo: MaintenanceType
  descripcion: string
  proveedor?: string
  costo_mano_obra: number
  estado: MaintenanceStatus
  socio_responsable: string
  articulos_usados?: ArticleUsed[]
}

export interface ArticleUsed {
  articulo_id: string
  articulo_nombre: string
  cantidad: number
  costo_unitario: number
  subtotal: number
}