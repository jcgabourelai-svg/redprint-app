export interface PrinterModel {
  id: number
  brand_id: number
  nombre: string
  marca?: string | null
}

export interface PrinterBrand {
  id: number
  nombre: string
  slug?: string
  modelos?: PrinterModel[]
}
