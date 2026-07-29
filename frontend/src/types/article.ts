import type { ArticleType } from './enums'
import type { PrinterModel } from './printer-model'

export interface Article {
  id: string
  tipo_articulo: ArticleType
  subtipo?: string | null
  nombre: string
  marca?: string | null
  modelo_sku?: string | null
  stock_actual: number
  umbral_reposicion: number
  costo_unitario: number
  proveedor_id?: number | null
  modelos_compatibles?: PrinterModel[]
  activo?: boolean
  motivo_baja?: string | null
  fecha_baja?: string | null
  is_low_stock?: boolean
  fecha_creacion?: string | null
}
