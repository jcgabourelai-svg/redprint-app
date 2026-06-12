import type { ArticleType } from './enums'

export interface Article {
  id: string
  nombre: string
  tipo: ArticleType
  marca: string
  modelo: string
  cantidad_en_stock: number
  umbral_reposicion: number
  costo_unitario: number
  compatible_con: string[]
}