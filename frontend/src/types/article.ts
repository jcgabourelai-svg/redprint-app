import type { ArticleType } from './enums'

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
  impresoras_compatibles?: number[]
  activo?: boolean
  is_low_stock?: boolean
  fecha_creacion?: string | null
}
